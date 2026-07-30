"""Pydantic contracts for demand forecasting APIs."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class ForecastOverrideIn(BaseModel):
    forecastId: int = Field(..., ge=1)
    expectedVersion: int = Field(..., ge=1)
    adjustedUnits: float = Field(..., ge=0, le=500)
    adjustedMachineHours: float = Field(..., ge=0, le=100000)
    reason: str = Field(..., min_length=8, max_length=500)


class RecommendationFeedbackIn(BaseModel):
    recommendationId: Optional[int] = Field(default=None, ge=1)
    forecastId: Optional[int] = Field(default=None, ge=1)
    decision: Literal["ACCEPTED", "REJECTED", "MANUAL_REVIEW", "ALTERNATIVE_SELECTED"]
    rejectionReason: Optional[str] = Field(default=None, max_length=500)
    selectedPackageCode: Optional[str] = Field(default=None, max_length=60)
    details: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_reference_and_reason(self):
        if self.recommendationId is None and self.forecastId is None:
            raise ValueError("recommendationId or forecastId is required")
        if self.decision == "REJECTED" and not self.rejectionReason:
            raise ValueError("rejectionReason is required when rejecting a recommendation")
        return self


class ManualReviewIn(BaseModel):
    forecastId: int = Field(..., ge=1)
    reason: str = Field(..., min_length=8, max_length=500)
    urgency: Literal["STANDARD", "HIGH", "CRITICAL"] = "STANDARD"


class DealerActionDecisionIn(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    expectedVersion: int = Field(default=1, ge=1)
    reason: str = Field(..., min_length=5, max_length=500)


class SyntheticGenerateIn(BaseModel):
    seed: int = 20260730
    projectCount: int = Field(default=28, ge=20, le=60)
    weeks: int = Field(default=52, ge=26, le=104)


class RetrainDemandModelIn(BaseModel):
    seed: int = 20260730
    nEstimators: int = Field(default=160, ge=40, le=500)
    randomState: int = 42
