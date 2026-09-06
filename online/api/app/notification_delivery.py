from __future__ import annotations

import base64
import hashlib
import json
import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, SessionLocal, engine, get_db
from .online_notifications import build_notifications
from .online_app import app


CHANNELS = {
    "feishu": "飞书",
    "wecom": "企业微信",
    "dingtalk": "钉钉",
    "other": "其他",
}
CATEGORY_NAMES = {
    "reply": "客户回复",
    "followup": "客户跟进",
    "mail": "邮件异常",
    "deal": "询盘 / 业务",
}
DEFAULT_CATEGORIES = ["reply", "followup", "mail", "deal"]


class NotificationRoute(Base):
    __tablename__ = "notification_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), default="")
    channel: Mapped[str] = mapped_column(String(40), default="other", index=True)
    encrypted_destination: Mapped[str] = mapped_column(Text, default="")
    categories_json: Mapped[str] = mapped_column(Text, default='["reply","followup","mail","deal"]')
    high_only: Mapped[int] = mapped_column(Integer, default=0)
    timezone_name: Mapped[str] = mapped_column(String(80), default="Asia/Shanghai")
    quiet_start: Mapped[str] = mapped_column(String(5), default="22:00")
    quiet_end: Mapped[str] = mapped_column(String(5), default="08:00")
    enabled: Mapped[int] = mapped_column(Integer, default=1, index=True)
    updated_by: Mapped[str] = mapped_column(String(160), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    delivery_key: Mapped[str] = mapped_column(String(400), unique=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, index=True)
    event_key: Mapped[str] = mapped_column(String(255), index=True)
    state: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(Text, default="")
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


Base.metadata.create_all(engine)


class RouteCreate(BaseModel):
    name: str = Field(default="", max_length=160)
    channel: str = Field(default="feishu", pattern="^(feishu|wecom|dingtalk|other)$")
    destination: str = Field(min_length=8, max_length=4000)
    categories: list[str] = Field(default_factory=lambda: list(DEFAULT_CATEGORIES), max_length=10)
    high_only: bool = False
    timezone_name: str = Field(default="Asia/Shanghai", max_length=80)
    quiet_start: str = Field(default="22:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    quiet_end: str = Field(default="08:00", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    enabled: bool = True


class RoutePatch(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    channel: str | None = Field(default=None, pattern="^(feishu|wecom|dingtalk|other)$")
    destination: str | None = Field(default=None, max_length=4000)
    categories: list[str] | None = Field(default=None, max_length=10)
    high_only: bool | None = None
    timezone_name: str | None = Field(default=None, max_length=80)
    quiet_start: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    quiet_end: str | None = Field(default=None, pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    enabled: bool | None = None
    clear_destination: bool = False


def _fernet() -> Fernet:
    secret = os.getenv("HUIDI_SECRET_KEY", "").strip()
    if len(secret) < 16:
        raise HTTPException(503, "服务器安全密钥还没有配置，暂时不能保存提醒方式")
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest()))


def _encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii") if value else ""


def _decrypt(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeError):
        raise HTTPException(503, "这个提醒方式无法读取，请管理员重新连接")


def _member(request: Request) -> dict[str, Any]:
    member = getattr(request.state, "team_member", None)
    return member if isinstance(member, dict) else {}


def _require_manager(request: Request) -> dict[str, Any]:
    member = _member(request)
    if not member:
        return {"display_name": "单人使用", "role": "owner"}
    if str(member.get("role") or "") not in {"owner", "admin"}:
        raise HTTPException(403, "只有老板或管理员可以修改提醒方式")
    return member


def _categories(value: str) -> list[str]:
    try:
        raw = json.loads(value or "[]")
    except Exception:
        raw = []
    return [x for x in raw if x in CATEGORY_NAMES]


def _validate_categories(values: list[str]) -> list[str]:
    out = []
    for value in values:
        if value not in CATEGORY_NAMES:
            raise HTTPException(400, "提醒类型不支持")
        if value not in out:
            out.append(value)
    return out or list(DEFAULT_CATEGORIES)


def route_dict(row: NotificationRoute) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name or CHANNELS.get(row.channel, "提醒"),
        "channel": row.channel,
        "channel_name": CHANNELS.get(row.channel, row.channel),
        "destination_saved": bool(row.encrypted_destination),
        "categories": _categories(row.categories_json),
        "category_names": [CATEGORY_NAMES[x] for x in _categories(row.categories_json)],
        "high_only": bool(row.high_only),
        "timezone_name": row.timezone_name,
        "quiet_start": row.quiet_start,
        "quiet_end": row.quiet_end,
        "enabled": bool(row.enabled),
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _local_now(row: NotificationRoute) -> datetime:
    try:
        zone = ZoneInfo(row.timezone_name or "Asia/Shanghai")
    except Exception:
        zone = timezone.utc
    return datetime.now(timezone.utc).astimezone(zone)


def _in_quiet_hours(row: NotificationRoute) -> bool:
    if not row.quiet_start or not row.quiet_end or row.quiet_start == row.quiet_end:
        return False
    current = _local_now(row).strftime("%H:%M")
    start, end = row.quiet_start, row.quiet_end
    return start <= current < end if start < end else current >= start or current < end


def _message_text(event: dict[str, Any], test: bool = False) -> str:
    if test:
        return "HUIDI 提醒连接正常。以后重要客户回复、逾期跟进和业务异常可发送到这里。"
    lines = [f"HUIDI · {event.get('title') or '需要处理'}"]
    summary = str(event.get("summary") or "").strip()
    if summary:
        lines.append(summary[:600])
    due = str(event.get("due_at") or "").strip()
    if due:
        lines.append(f"时间：{due.replace('T', ' ')[:16]}")
    return "\n".join(lines)


def _post_destination(channel: str, destination: str, text: str, event: dict[str, Any]) -> None:
    if channel == "feishu":
        payload = {"msg_type": "text", "content": {"text": text}}
    elif channel in {"wecom", "dingtalk"}:
        payload = {"msgtype": "text", "text": {"content": text}}
    else:
        payload = {
            "title": str(event.get("title") or "HUIDI 提醒"),
            "summary": str(event.get("summary") or ""),
            "priority": str(event.get("priority") or "normal"),
            "event_key": str(event.get("key") or ""),
            "text": text,
        }
    try:
        with httpx.Client(timeout=15) as client:
            response = client.post(destination, json=payload, headers={"Content-Type": "application/json"})
    except httpx.RequestError as exc:
        raise RuntimeError("暂时连接不到提醒服务") from exc
    if response.status_code >= 400:
        raise RuntimeError(f"提醒服务返回 {response.status_code}")


def _should_send(route: NotificationRoute, event: dict[str, Any]) -> bool:
    if not route.enabled or not route.encrypted_destination:
        return False
    if event.get("state") != "open":
        return False
    if event.get("category") not in _categories(route.categories_json):
        return False
    if route.high_only and event.get("priority") != "high":
        return False
    if _in_quiet_hours(route):
        return False
    return True


def run_notification_delivery_once(limit: int = 40) -> dict[str, int]:
    db = SessionLocal()
    try:
        routes = db.scalars(select(NotificationRoute).where(NotificationRoute.enabled == 1)).all()
        if not routes:
            return {"routes": 0, "sent": 0, "failed": 0, "skipped": 0}
        events = build_notifications(db)
        event_map = {str(x.get("key")): x for x in events if x.get("key")}
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        sent = failed = skipped = 0

        # Create one durable delivery row per route + business event.
        for route in routes:
            for event in events:
                if not _should_send(route, event):
                    continue
                key = f"{route.id}:{event['key']}"
                if db.scalar(select(NotificationDelivery).where(NotificationDelivery.delivery_key == key)):
                    continue
                db.add(
                    NotificationDelivery(
                        delivery_key=key,
                        route_id=route.id,
                        event_key=str(event["key"]),
                        state="pending",
                        attempts=0,
                        next_attempt_at=now,
                    )
                )
        db.commit()

        rows = db.scalars(
            select(NotificationDelivery)
            .where(NotificationDelivery.state.in_(["pending", "retrying"]))
            .where(NotificationDelivery.next_attempt_at <= now)
            .order_by(NotificationDelivery.next_attempt_at.asc(), NotificationDelivery.id.asc())
            .limit(limit)
        ).all()
        for delivery in rows:
            route = db.get(NotificationRoute, delivery.route_id)
            event = event_map.get(delivery.event_key)
            if not route or not event or not _should_send(route, event):
                # Quiet hours are temporary; keep the row for another cycle.
                if route and event and _in_quiet_hours(route):
                    delivery.next_attempt_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).replace(tzinfo=None)
                    delivery.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    continue
                delivery.state = "skipped"
                delivery.updated_at = datetime.now(timezone.utc)
                db.commit()
                skipped += 1
                continue
            delivery.attempts += 1
            delivery.updated_at = datetime.now(timezone.utc)
            try:
                _post_destination(route.channel, _decrypt(route.encrypted_destination), _message_text(event), event)
                delivery.state = "sent"
                delivery.sent_at = datetime.now(timezone.utc)
                delivery.last_error = ""
                sent += 1
            except Exception as exc:
                delivery.last_error = str(exc)[:1000]
                if delivery.attempts >= 5:
                    delivery.state = "failed"
                    failed += 1
                else:
                    delivery.state = "retrying"
                    minutes = min(120, 5 * (2 ** max(0, delivery.attempts - 1)))
                    delivery.next_attempt_at = (datetime.now(timezone.utc) + timedelta(minutes=minutes)).replace(tzinfo=None)
            db.commit()
        return {"routes": len(routes), "sent": sent, "failed": failed, "skipped": skipped}
    finally:
        db.close()


@app.get("/api/notification-routes")
def list_routes(request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    rows = db.scalars(select(NotificationRoute).order_by(NotificationRoute.id.asc())).all()
    return {"items": [route_dict(x) for x in rows], "channels": CHANNELS, "categories": CATEGORY_NAMES}


@app.post("/api/notification-routes")
def create_route(req: RouteCreate, request: Request, db: Session = Depends(get_db)):
    current = _require_manager(request)
    try:
        ZoneInfo(req.timezone_name)
    except Exception:
        raise HTTPException(400, "公司时区填写不正确")
    row = NotificationRoute(
        name=req.name.strip() or CHANNELS[req.channel],
        channel=req.channel,
        encrypted_destination=_encrypt(req.destination.strip()),
        categories_json=json.dumps(_validate_categories(req.categories), ensure_ascii=False),
        high_only=1 if req.high_only else 0,
        timezone_name=req.timezone_name.strip(),
        quiet_start=req.quiet_start,
        quiet_end=req.quiet_end,
        enabled=1 if req.enabled else 0,
        updated_by=str(current.get("display_name") or current.get("email") or "管理员")[:160],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "route": route_dict(row)}


@app.patch("/api/notification-routes/{route_id}")
def patch_route(route_id: int, req: RoutePatch, request: Request, db: Session = Depends(get_db)):
    current = _require_manager(request)
    row = db.get(NotificationRoute, route_id)
    if not row:
        raise HTTPException(404, "没有找到这个提醒方式")
    values = req.model_dump(exclude_none=True)
    if "timezone_name" in values:
        try:
            ZoneInfo(str(values["timezone_name"]))
        except Exception:
            raise HTTPException(400, "公司时区填写不正确")
    for field in ["name", "channel", "timezone_name", "quiet_start", "quiet_end"]:
        if field in values:
            setattr(row, field, str(values[field]).strip())
    if "categories" in values:
        row.categories_json = json.dumps(_validate_categories(values["categories"]), ensure_ascii=False)
    if "high_only" in values:
        row.high_only = 1 if values["high_only"] else 0
    if "enabled" in values:
        row.enabled = 1 if values["enabled"] else 0
    if req.clear_destination:
        row.encrypted_destination = ""
    elif req.destination is not None and req.destination.strip():
        row.encrypted_destination = _encrypt(req.destination.strip())
    row.updated_by = str(current.get("display_name") or current.get("email") or "管理员")[:160]
    row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return {"ok": True, "route": route_dict(row)}


@app.delete("/api/notification-routes/{route_id}")
def delete_route(route_id: int, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = db.get(NotificationRoute, route_id)
    if not row:
        raise HTTPException(404, "没有找到这个提醒方式")
    deliveries = db.scalars(select(NotificationDelivery).where(NotificationDelivery.route_id == route_id)).all()
    for delivery in deliveries:
        db.delete(delivery)
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.post("/api/notification-routes/{route_id}/test")
def test_route(route_id: int, request: Request, db: Session = Depends(get_db)):
    _require_manager(request)
    row = db.get(NotificationRoute, route_id)
    if not row or not row.encrypted_destination:
        raise HTTPException(404, "这个提醒方式还没有连接")
    try:
        _post_destination(
            row.channel,
            _decrypt(row.encrypted_destination),
            _message_text({}, test=True),
            {"key": "connection-test", "title": "HUIDI 提醒连接检查", "priority": "normal"},
        )
    except Exception as exc:
        raise HTTPException(502, str(exc))
    return {"ok": True, "message": f"{row.name or CHANNELS.get(row.channel, '提醒')}连接正常"}


@app.post("/api/notification-routes/run")
def run_routes_now(request: Request):
    _require_manager(request)
    return {"ok": True, **run_notification_delivery_once(80)}


_runtime_lock = threading.Lock()
_runtime_thread: threading.Thread | None = None
_runtime_stop = threading.Event()


def _runtime_loop() -> None:
    while not _runtime_stop.is_set():
        try:
            run_notification_delivery_once(40)
        except Exception:
            pass
        _runtime_stop.wait(60)


def _ensure_runtime_thread() -> None:
    global _runtime_thread
    if os.getenv("HUIDI_DISABLE_BACKGROUND_JOBS", "").strip() == "1":
        return
    if os.getenv("CI", "").strip().lower() in {"1", "true", "yes"}:
        return
    with _runtime_lock:
        if _runtime_thread and _runtime_thread.is_alive():
            return
        _runtime_thread = threading.Thread(target=_runtime_loop, name="huidi-notification-delivery", daemon=True)
        _runtime_thread.start()


_ensure_runtime_thread()
