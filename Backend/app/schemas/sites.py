"""Site / checkout request bodies."""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class SiteCreate(BaseModel):
    siteName: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    status: str = "ACTIVE"
    companyId: Optional[int] = None


class AssignmentCreate(BaseModel):
    contractId: int
    siteId: int


class CheckoutScanBody(BaseModel):
    action: Literal["CHECK_OUT", "CHECK_IN"]
    siteId: int
    qrCode: Optional[str] = None
    rfidTag: Optional[str] = None
    equipmentId: Optional[int] = None
    operatorId: Optional[str] = None
    actorUserId: Optional[int] = None
