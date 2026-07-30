"""Auth request/response schemas."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Demo login — maps email/role to a JWT (no password store yet)."""

    email: str = Field(..., min_length=3)
    password: str = Field(default="demo", min_length=1)
    role: str = Field(default="FLEET_MANAGER")
    companyId: Optional[int] = None
    dealerId: Optional[int] = None
    siteId: Optional[int] = None
    actorId: Optional[str] = None


class LoginResponse(BaseModel):
    success: bool
    accessToken: str
    tokenType: str = "bearer"
    expiresInMinutes: int
    user: dict
