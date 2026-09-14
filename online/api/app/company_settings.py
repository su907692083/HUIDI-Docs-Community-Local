from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
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
    company_name: Mapped[str] = mapped_column(String(255), default="")
    legal_name: Mapped[str] = mapped_column(String(255), default="")
    country: Mapped[str] = mapped_column(String(120), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    website: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    tax_id: Mapped[str] = mapped_column(String(160), default="")
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class CompanyBankAccount(Base):
    """Payment master data subordinate to CompanySetting; not a second module."""

    __tablename__ = "company_bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    label: Mapped[str] = mapped_column(String(120), default="")
    bank_name: Mapped[str] = mapped_column(String(255), default="")
    account_name: Mapped[str] = mapped_column(String(255), default="")
    account_number: Mapped[str] = mapped_column(String(255), default="")
    swift_code: Mapped[str] = mapped_column(String(120), default="")
    bank_address: Mapped[str] = mapped_column(Text, default="")
    currency: Mapped[str] = mapped_column(String(40), default="")
    is_default: Mapped[int] = mapped_column(Integer, default=0, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


Base.metadata.create_all(engine)


class CompanySettingPatch(BaseModel):
    timezone_name: str | None = Field(default=None, min_length=3, max_length=80)
    company_name: str | None = Field(default=None, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=120)
    address: str | None = Field(default=None, max_length=4000)
    website: str | None = Field(default=None, max_length=2000)
    phone: str | None = Field(default=None, max_length=120)
    email: str | None = Field(default=None, max_length=255)
    tax_id: str | None = Field(default=None, max_length=160)


class BankAccountRequest(BaseModel):
    label: str = Field(default="", max_length=120)
    bank_name: str = Field(min_length=1, max_length=255)
    account_name: str = Field(min_length=1, max_length=255)
    account_number: str = Field(min_length=1, max_length=255)
    swift_code: str = Field(default="", max_length=120)
    bank_address: str = Field(default="", max_length=4000)
    currency: str = Field(default="", max_length=40)
    is_default: bool = False
    notes: str = Field(default="", max_length=4000)


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
        raise HTTPException(403, "只有老板或管理员可以修改公司设置")
    return member


def bank_account_dict(row: CompanyBankAccount) -> dict[str, Any]:
    return {
        "id": row.id,
        "label": row.label,
        "bank_name": row.bank_name,
        "account_name": row.account_name,
        "account_number": row.account_number,
        "swift_code": row.swift_code,
        "bank_address": row.bank_address,
        "currency": row.currency,
        "is_default": bool(row.is_default),
        "notes": row.notes,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def company_bank_accounts(db: Session) -> list[CompanyBankAccount]:
    return db.scalars(
        select(CompanyBankAccount).order_by(
            CompanyBankAccount.is_default.desc(),
            CompanyBankAccount.updated_at.desc(),
            CompanyBankAccount.id.desc(),
        )
    ).all()


def default_bank_account(db: Session) -> CompanyBankAccount | None:
    rows = company_bank_accounts(db)
    for row in rows:
        if row.is_default:
            return row
    return rows[0] if rows else None


def _apply_bank_request(row: CompanyBankAccount, req: BankAccountRequest) -> None:
    for key, value in req.model_dump().items():
        if key == "is_default":
            setattr(row, key, 1 if value else 0)
        else:
            setattr(row, key, value.strip() if isinstance(value, str) else value)
    row.updated_at = datetime.now(timezone.utc)


def _ensure_bank_default(db: Session, row: CompanyBankAccount, requested_default: bool) -> None:
    siblings = db.scalars(select(CompanyBankAccount).where(CompanyBankAccount.id != row.id)).all()
    if requested_default:
        for sibling in siblings:
            sibling.is_default = 0
        row.is_default = 1
        return
    if any(bool(sibling.is_default) for sibling in siblings):
        row.is_default = 0
        return
    row.is_default = 1


def setting_payload(db: Session) -> dict[str, Any]:
    name = company_timezone_name(db)
    row = db.get(CompanySetting, 1)
    accounts = company_bank_accounts(db)
    return {
        "timezone_name": name,
        "timezone_label": TIMEZONE_CHOICES.get(name, name),
        "choices": TIMEZONE_CHOICES,
        "company_name": row.company_name if row else "",
        "legal_name": row.legal_name if row else "",
        "country": row.country if row else "",
        "address": row.address if row else "",
        "website": row.website if row else "",
        "phone": row.phone if row else "",
        "email": row.email if row else "",
        "tax_id": row.tax_id if row else "",
        "bank_accounts": [bank_account_dict(x) for x in accounts],
        "default_bank_account": bank_account_dict(default_bank_account(db)) if accounts else None,
        "updated_at": row.updated_at.isoformat() if row and row.updated_at else None,
    }


@app.get("/api/company-settings")
def get_company_settings(db: Session = Depends(get_db)):
    return setting_payload(db)


@app.put("/api/company-settings")
def save_company_settings(req: CompanySettingPatch, request: Request, db: Session = Depends(get_db)):
    current = _require_manager(request)
    values = req.model_dump(exclude_none=True)
    if "timezone_name" in values:
        name = str(values["timezone_name"] or "").strip()
        try:
            ZoneInfo(name)
        except Exception:
            raise HTTPException(400, "请选择有效的公司工作时区")
        values["timezone_name"] = name
    row = db.get(CompanySetting, 1)
    if not row:
        row = CompanySetting(id=1, timezone_name=_default_timezone())
        db.add(row)
    for key, value in values.items():
        setattr(row, key, value.strip() if isinstance(value, str) else value)
    row.updated_by = str(current.get("display_name") or current.get("email") or "管理员")[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {"ok": True, **setting_payload(db)}


@app.post("/api/company-settings/bank-accounts")
def create_bank_account(req: BankAccountRequest, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = CompanyBankAccount()
    db.add(row)
    db.flush()
    _apply_bank_request(row, req)
    _ensure_bank_default(db, row, req.is_default)
    db.commit()
    db.refresh(row)
    return {"ok": True, "bank_account": bank_account_dict(row)}


@app.put("/api/company-settings/bank-accounts/{account_id}")
def update_bank_account(
    account_id: int,
    req: BankAccountRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_manager(request)
    row = db.get(CompanyBankAccount, account_id)
    if not row:
        raise HTTPException(404, "没有找到这个收款账户")
    _apply_bank_request(row, req)
    _ensure_bank_default(db, row, req.is_default)
    db.commit()
    db.refresh(row)
    return {"ok": True, "bank_account": bank_account_dict(row)}


@app.delete("/api/company-settings/bank-accounts/{account_id}")
def delete_bank_account(account_id: int, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = db.get(CompanyBankAccount, account_id)
    if not row:
        raise HTTPException(404, "没有找到这个收款账户")
    was_default = bool(row.is_default)
    db.delete(row)
    db.flush()
    if was_default:
        replacement = db.scalar(
            select(CompanyBankAccount).order_by(
                CompanyBankAccount.updated_at.desc(),
                CompanyBankAccount.id.desc(),
            )
        )
        if replacement:
            replacement.is_default = 1
    db.commit()
    return {"ok": True}
