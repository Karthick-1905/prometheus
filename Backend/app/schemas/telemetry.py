"""Pydantic schemas for telemetry + ML feature vectors."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TelemetryIn(BaseModel):
    timestamp: Optional[datetime] = None
    equipmentId: str
    equipmentType: str = "Excavator"
    dealerId: Optional[str] = None
    siteId: Optional[str] = None
    operatorId: Optional[str] = None
    engineStatus: str = "ON"
    fuelLevel: float = 0
    engineHours: float = 0
    idleHours: float = 0
    speed: float = 0
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    engineTemperature: float = 0
    hydraulicPressure: float = 0
    batteryVoltage: float = 0
    loadPercentage: float = 0
    vibrationLevel: float = 0
    rentalStatus: str = "Working"


class FeatureVector(BaseModel):
    """6-dim rental usage vector for Isolation Forest."""
    engineHoursPerDay: float = Field(..., ge=0)
    idleHoursPerDay: float = Field(..., ge=0)
    rentalDays: float = Field(..., ge=0)
    hasOperator: float = Field(..., ge=0, le=1)
    hasSite: float = Field(..., ge=0, le=1)
    idleRatio: float = Field(..., ge=0, le=1)
    equipmentId: Optional[str] = None
    equipmentType: Optional[str] = None


class PredictResponse(BaseModel):
    equipmentId: Optional[str] = None
    isAnomaly: bool
    anomalyScore: float
    confidence: str
    message: str


class TrainRequest(BaseModel):
    csv_path: Optional[str] = None
    n_estimators: int = Field(default=200, ge=10, le=500)
    contamination: float = Field(default=0.02, ge=0.01, le=0.5)
    random_state: int = 42


class TrainResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    success: bool
    message: str
    n_samples: int
    n_estimators: int
    contamination: float
    model_path: str
    training_time_ms: float


class ResolveAlertBody(BaseModel):
    alertId: int
