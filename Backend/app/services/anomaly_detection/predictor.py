"""Isolation Forest load + score (migrated from python-ml/model/predictor.py)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np

from app.config import get_settings

DEFAULT_FEATURE_COLS = [
    "engineHoursPerDay",
    "idleHoursPerDay",
    "rentalDays",
    "hasOperator",
    "hasSite",
    "idleRatio",
]


class IsolationForestPredictor:
    def __init__(self) -> None:
        self._clf = None
        self._scaler = None
        self._meta: Optional[dict[str, Any]] = None

    @property
    def artifacts_dir(self) -> Path:
        return Path(get_settings().artifacts_dir)

    @property
    def model_path(self) -> Path:
        return self.artifacts_dir / "isolation_forest.joblib"

    @property
    def scaler_path(self) -> Path:
        return self.artifacts_dir / "scaler.joblib"

    @property
    def meta_path(self) -> Path:
        return self.artifacts_dir / "model_meta.json"

    def load_model(self) -> bool:
        if not self.model_path.exists() or not self.scaler_path.exists():
            return False
        self._clf = joblib.load(self.model_path)
        self._scaler = joblib.load(self.scaler_path)
        if self.meta_path.exists():
            with open(self.meta_path, encoding="utf-8") as f:
                self._meta = json.load(f)
        else:
            self._meta = {"feature_cols": DEFAULT_FEATURE_COLS, "feature_dim": 6}
        print(f"Isolation Forest loaded from {self.model_path}")
        return True

    def is_loaded(self) -> bool:
        return self._clf is not None and self._scaler is not None

    def get_meta(self) -> Optional[dict[str, Any]]:
        return self._meta

    def reload_model(self) -> bool:
        self._clf = self._scaler = self._meta = None
        return self.load_model()

    def score(self, feature_vector: list[float] | dict) -> tuple[bool, float, str]:
        if not self.is_loaded():
            raise RuntimeError("Model not loaded. Train first or place artifacts in Backend/artifacts/")

        feature_cols = (self._meta or {}).get("feature_cols") or DEFAULT_FEATURE_COLS
        if isinstance(feature_vector, list):
            X = np.array([feature_vector], dtype=float)
        else:
            X = np.array([[float(feature_vector[c]) for c in feature_cols]], dtype=float)

        X_scaled = self._scaler.transform(X)
        raw_score = float(self._clf.decision_function(X_scaled)[0])
        thr = float((self._meta or {}).get("decision_threshold", 0.0))
        is_anomaly = raw_score < thr
        normalized = float(np.clip(0.5 + (thr - raw_score), 0.0, 1.0))

        if normalized >= 0.75:
            confidence = "HIGH"
        elif normalized >= 0.60:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        return is_anomaly, round(normalized, 4), confidence


# Module-level singleton used by API routes
predictor = IsolationForestPredictor()
