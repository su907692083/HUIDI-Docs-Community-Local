from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from . import service_hub
from .service_adapters import execute_service_request


def _adapted_external_provider(
    db: Session,
    service_key: str,
    payload: dict[str, Any],
    missing_message: str,
) -> Any:
    try:
        return execute_service_request(db, service_key, payload)
    except Exception as exc:
        # Keep the product-facing missing-connection wording from the business tool.
        status = getattr(exc, "status_code", None)
        if status == 503:
            from fastapi import HTTPException

            raise HTTPException(503, missing_message) from exc
        raise


# The existing business routes resolve this module global at request time. This
# keeps one Customer / Deal / Intelligence owner while replacing the old
# hard-coded POST+Bearer transport with the configurable adapter layer.
service_hub._external_provider = _adapted_external_provider
