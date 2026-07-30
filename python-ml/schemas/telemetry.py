"""
schemas/telemetry.py
--------------------
Pydantic models for the Isolation Forest ML API.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ── Predict ──────────────────────────────────────────────────────────────────

class FeatureVector(BaseModel):
    """
    14-dimensional feature vector that maps 1:1 to the TypeScript
    buildFeatureVector() function in src/services/anomaly/isolation-forest/feature-vector.ts.
    """
    # Raw sensor values
    fuelLevel:            float = Field(..., ge=0,   le=100,  description="Fuel tank level (%)")
    engineHours:          float = Field(..., ge=0,             description="Cumulative engine hours")
    idleHours:            float = Field(..., ge=0,             description="Cumulative idle hours")
    speed:                float = Field(..., ge=0,             description="Current speed (km/h)")
    engineTemperature:    float = Field(..., ge=0,   le=200,   description="Engine temp (°C)")
    hydraulicPressure:    float = Field(..., ge=0,             description="Hydraulic pressure (bar)")
    batteryVoltage:       float = Field(..., ge=0,             description="Battery voltage (V)")
    loadPercentage:       float = Field(..., ge=0,   le=100,  description="Engine load (%)")
    vibrationLevel:       float = Field(..., ge=0,             description="Vibration (mm/s)")

    # Engineered delta features
    fuelDelta:            float = Field(..., ge=0,             description="Fuel drop since last reading (%)")
    engineHoursDelta:     float = Field(..., ge=0,             description="Engine hours gained this step")
    idleHoursDelta:       float = Field(..., ge=0,             description="Idle hours gained this step")

    # Binary / spatial
    engineOn:             float = Field(..., ge=0,   le=1,    description="Engine status (1=ON, 0=OFF)")
    distanceFromSiteCenter: float = Field(..., ge=0,          description="GPS distance from site center (degrees)")

    # Context (not used in scoring, only for response enrichment)
    equipmentId:          Optional[str] = None
    equipmentType:        Optional[str] = None


class PredictResponse(BaseModel):
    equipmentId:     Optional[str]
    isAnomaly:       bool
    anomalyScore:    float = Field(..., description="Score in [0,1]; higher = more anomalous")
    confidence:      str   = Field(..., description="LOW / MEDIUM / HIGH")
    message:         str


# ── Train ─────────────────────────────────────────────────────────────────────

class TrainRequest(BaseModel):
    csv_path:               Optional[str]  = None
    n_estimators:           int            = Field(default=100, ge=10,  le=500)
    contamination:          float          = Field(default=0.1, ge=0.01, le=0.5)
    max_samples:            Optional[int]  = Field(default=None)
    random_state:           int            = Field(default=42)


class TrainResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    success:         bool
    message:         str
    n_samples:       int
    n_estimators:    int
    contamination:   float
    model_path:      str
    training_time_ms: float


# ── Model Status ──────────────────────────────────────────────────────────────

class ModelStatusResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    loaded:          bool
    model_path:      str
    trained_at:      Optional[str]
    n_estimators:    Optional[int]
    contamination:   Optional[float]
    n_training_samples: Optional[int]
