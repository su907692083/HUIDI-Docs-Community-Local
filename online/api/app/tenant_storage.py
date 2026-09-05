from __future__ import annotations

import os
import threading
from contextvars import ContextVar, Token
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from . import main as main_module
from .main import Base, DB_URL, engine as primary_engine


class ControlBase(DeclarativeBase):
    """Control-plane tables shared by all companies (organizations, accounts, sessions)."""


ControlSessionLocal = sessionmaker(bind=primary_engine, autoflush=False, autocommit=False)

_current_organization: ContextVar[int] = ContextVar("huidi_organization_id", default=1)
_engine_lock = threading.Lock()
_tenant_engines: dict[int, Engine] = {1: primary_engine}
_tenant_sessions: dict[int, sessionmaker[Session]] = {
    1: sessionmaker(bind=primary_engine, autoflush=False, autocommit=False)
}


def current_organization_id() -> int:
    try:
        value = int(_current_organization.get())
    except Exception:
        value = 1
    return max(1, value)


def set_current_organization(organization_id: int) -> Token:
    return _current_organization.set(max(1, int(organization_id)))


def reset_current_organization(token: Token) -> None:
    _current_organization.reset(token)


def _sqlite_tenant_url(organization_id: int) -> str:
    raw_path = DB_URL[len("sqlite:///") :]
    source = Path(raw_path)
    suffix = source.suffix or ".db"
    stem = source.stem or "huidi-online"
    directory = source.parent / f"{stem}-tenants"
    directory.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{directory / f'{stem}-org-{organization_id}{suffix}'}"


def tenant_database_url(organization_id: int) -> str:
    organization_id = max(1, int(organization_id))
    if organization_id == 1:
        return DB_URL
    template = os.getenv("HUIDI_TENANT_DATABASE_URL_TEMPLATE", "").strip()
    if template:
        if "{organization_id}" not in template:
            raise RuntimeError("HUIDI_TENANT_DATABASE_URL_TEMPLATE 必须包含 {organization_id}")
        return template.format(organization_id=organization_id)
    if DB_URL.startswith("sqlite:///"):
        return _sqlite_tenant_url(organization_id)
    raise RuntimeError(
        "多公司模式使用非 SQLite 数据库时，请配置 HUIDI_TENANT_DATABASE_URL_TEMPLATE，"
        "为每家公司提供独立数据库。"
    )


def _engine_for(organization_id: int) -> Engine:
    organization_id = max(1, int(organization_id))
    with _engine_lock:
        existing = _tenant_engines.get(organization_id)
        if existing is not None:
            return existing
        url = tenant_database_url(organization_id)
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        engine = create_engine(url, connect_args=connect_args)
        _tenant_engines[organization_id] = engine
        _tenant_sessions[organization_id] = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        return engine


def ensure_tenant_schema(organization_id: int) -> Engine:
    engine = _engine_for(organization_id)
    # Base.metadata grows while Daily Workbench modules are imported. Running
    # create_all on session acquisition is idempotent and ensures a new company
    # receives every currently registered business table before the first query.
    Base.metadata.create_all(engine)
    return engine


class TenantSessionRouter:
    """Drop-in replacement for the historical SessionLocal sessionmaker.

    Existing route code keeps calling SessionLocal(); this router selects a
    physically separate business database from the organization context set by
    the authentication middleware.
    """

    def __call__(self, *args: Any, **kwargs: Any) -> Session:
        organization_id = current_organization_id()
        ensure_tenant_schema(organization_id)
        factory = _tenant_sessions[organization_id]
        return factory(*args, **kwargs)


def install_session_router() -> TenantSessionRouter:
    router = TenantSessionRouter()
    # get_db() resolves the module global at call time, and modules imported
    # afterwards capture the router as SessionLocal. Existing org #1 therefore
    # keeps its current database while org #2+ are physically separated.
    main_module.SessionLocal = router
    return router


def get_control_db():
    db = ControlSessionLocal()
    try:
        yield db
    finally:
        db.close()
