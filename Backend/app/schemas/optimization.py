"""API contracts for project planning and advisory fleet optimization."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ProjectPhaseIn(BaseModel):
    phaseCode: str = Field(..., min_length=1, max_length=50)
    phaseName: str = Field(..., min_length=2, max_length=120)
    sequence: int = Field(..., ge=1, le=500)
    plannedStart: date
    plannedEnd: date
    status: Literal["PLANNED", "IN_PROGRESS", "COMPLETED", "BLOCKED"] = "PLANNED"
    progressPercentage: float = Field(default=0, ge=0, le=100)
    scheduleConfidence: Literal["LOW", "MODERATE", "HIGH"] = "MODERATE"

    @model_validator(mode="after")
    def validate_dates(self):
        if self.plannedEnd < self.plannedStart:
            raise ValueError("plannedEnd cannot be earlier than plannedStart")
        return self


class PhaseRequirementIn(BaseModel):
    equipmentType: str = Field(..., min_length=2, max_length=80)
    requiredCapability: Optional[str] = Field(default=None, max_length=80)
    minimumCapacity: Optional[float] = Field(default=None, ge=0)
    requiredUnits: int = Field(..., ge=1, le=1000)
    plannedMachineHours: Optional[float] = Field(default=None, ge=0)
    requiredFrom: date
    requiredUntil: date
    criticality: Literal["STANDARD", "HIGH", "CRITICAL"] = "STANDARD"
    maximumAllowedDowntimeHours: int = Field(default=24, ge=0, le=720)
    substitutionAllowed: bool = False
    source: Literal["PROJECT_PLAN", "FORECAST_OVERRIDE", "SITE_CONFIRMED"] = "PROJECT_PLAN"

    @model_validator(mode="after")
    def validate_dates(self):
        if self.requiredUntil < self.requiredFrom:
            raise ValueError("requiredUntil cannot be earlier than requiredFrom")
        return self


class OptimizationRunIn(BaseModel):
    planningStart: date
    planningEnd: date

    @model_validator(mode="after")
    def validate_horizon(self):
        if self.planningEnd < self.planningStart:
            raise ValueError("planningEnd cannot be earlier than planningStart")
        if (self.planningEnd - self.planningStart).days > 180:
            raise ValueError("The deterministic optimizer supports at most 180 days")
        return self


class OptimizationDecisionIn(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    expectedVersion: int = Field(..., ge=1)
    reason: str = Field(..., min_length=8, max_length=500)
