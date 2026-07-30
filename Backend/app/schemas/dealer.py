"""Dealer inventory / contract bodies."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EquipmentCreate(BaseModel):
    equipmentName: str = Field(..., min_length=1)
    equipmentType: str = Field(..., min_length=1)
    model: Optional[str] = None
    serialNumber: Optional[str] = None
    dailyRentalCost: Optional[float] = None
    status: str = "AVAILABLE"


class EquipmentUpdate(BaseModel):
    equipmentName: Optional[str] = None
    equipmentType: Optional[str] = None
    model: Optional[str] = None
    serialNumber: Optional[str] = None
    dailyRentalCost: Optional[float] = None
    status: Optional[str] = None


class ContractCreate(BaseModel):
    companyId: int
    equipmentId: int
    rentalStart: datetime
    expectedReturn: datetime
