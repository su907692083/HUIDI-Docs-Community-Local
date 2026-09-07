from __future__ import annotations

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .business_center import OnlineDocumentRef
from .community_sync import (
    FORMAL_DOCUMENT_TYPES,
    _archived_sets,
    _clean,
    _community_document_record,
)
from .main import get_db
from .online_app import app


@app.get("/api/community-sync/document-records")
def community_document_records(db: Session = Depends(get_db)):
    """Return full Community document records for the current tenant cache.

    The record still lives under the existing OnlineDocumentRef owner. This is
    a bounded projection used by the reused Community Local IndexedDB cache so
    the original editor can open documents without one request per row.
    """

    archived = _archived_sets(db).get("document", set())
    records: list[dict] = []
    for ref in db.scalars(
        select(OnlineDocumentRef)
        .where(OnlineDocumentRef.document_type.in_(FORMAL_DOCUMENT_TYPES))
        .order_by(OnlineDocumentRef.updated_at.desc(), OnlineDocumentRef.id.desc())
        .limit(1000)
    ).all():
        record = _community_document_record(db, ref)
        if not record:
            continue
        record_id = _clean(record.get("id") or ref.document_id, 180)
        if record_id in archived:
            continue
        records.append(record)
    return {"ok": True, "records": records, "count": len(records)}
