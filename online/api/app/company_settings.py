from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, engine, get_db
from .online_app import app


TIMEZONE_CHOICES = {
    "Asia/Shanghai": "中国大陆",
    "Asia/Hong_Kong": "中国香港",
    "Asia/Singapore": "新加坡",
    "Asia/Tokyo": "日本",
    "Asia/Dubai": "阿联酋",
    "Asia/Kolkata": "印度",
    "Europe/London": "英国",
    "Europe/Berlin": "欧洲中部",
    "America/New_York": "美国东部",
    "America/Los_Angeles": "美国西部",
}


class CompanySetting(Base):
    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    timezone_name: Mapped[str] = mapped_column(String(80), default="Asia/Shanghai")
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class CompanySettingPatch(BaseModel):
    timezone_name: str = Field(min_length=3, max_length=80)


def _default_timezone() -> str:
    name = os.getenv("HUIDI_TIMEZONE", "Asia/Shanghai").strip() or "Asia/Shanghai"
    try:
        ZoneInfo(name)
        return name
    except Exception:
        return "Asia/Shanghai"


def company_timezone_name(db: Session) -> str:
    row = db.get(CompanySetting, 1)
    name = str(row.timezone_name if row else _default_timezone()).strip() or _default_timezone()
    try:
        ZoneInfo(name)
        return name
    except Exception:
        return _default_timezone()


def company_timezone(db: Session) -> ZoneInfo:
    return ZoneInfo(company_timezone_name(db))


def _member(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    return member if isinstance(member, dict) else {}


def _require_manager(request: Request) -> dict[str, Any]:
    member = _member(request)
    if not member:
        return {"display_name": "单人使用", "role": "owner"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以修改公司工作时间")
    return member


def setting_payload(db: Session) -> dict[str, Any]:
    name = company_timezone_name(db)
    row = db.get(CompanySetting, 1)
    return {
        "timezone_name": name,
        "timezone_label": TIMEZONE_CHOICES.get(name, name),
        "choices": TIMEZONE_CHOICES,
        "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
    }


@app.get("/api/company-settings")
def get_company_settings(db: Session = Depends(get_db)):
    return setting_payload(db)


@app.put("/api/company-settings")
def save_company_settings(req: CompanySettingPatch, request: Request, db: Session = Depends(get_db)):
    current = _require_manager(request)
    name = req.timezone_name.strip()
    try:
        ZoneInfo(name)
    except Exception:
        raise HTTPException(400, "请选择有效的公司工作时区")
    row = db.get(CompanySetting, 1)
    if not row:
        row = CompanySetting(id=1)
        db.add(row)
    row.timezone_name = name
    row.updated_by = str(current.get("display_name") or current.get("email") or "管理员")[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, **setting_payload(db)}
