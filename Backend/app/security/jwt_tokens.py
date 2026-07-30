"""JWT issue / verify helpers for dashboard auth."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import jwt

from app.config import get_settings


class TokenError(Exception):
    pass


def create_access_token(
    *,
    subject: str,
    role: str,
    company_id: Optional[int] = None,
    dealer_id: Optional[int] = None,
    site_id: Optional[int] = None,
    extra: Optional[dict[str, Any]] = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "company_id": company_id,
        "dealer_id": dealer_id,
        "site_id": site_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expire_minutes)).timestamp()),
        "typ": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("typ") not in (None, "access"):
        raise TokenError("Invalid token type")
    return payload
