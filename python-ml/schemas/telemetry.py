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
    6-dimensional feature vector corresponding to the historical rental dataset
    from the problem statement (docs/ps.txt):
      engineHoursPerDay, idleHoursPerDay, rentalDays, hasOperator, hasSite, idleRatio
    """
    engineHoursPerDay: float = Field(..., ge=0, description="Average engine hours per day")
    idleHoursPerDay:   float = Field(..., ge=0, description="Average idle hours per day")
    rentalDays:        float = Field(..., ge=0, description="Total days rented")
    hasOperator:       float = Field(..., ge=0, le=1, description="Binary operator presence (1=Yes, 0=No)")
    hasSite:           float = Field(..., ge=0, le=1, description="Binary site presence (1=Yes, 0=No)")
    idleRatio:         float = Field(..., ge=0, le=1, description="Idle hours ratio")

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
