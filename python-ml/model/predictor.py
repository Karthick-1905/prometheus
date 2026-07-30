"""
model/predictor.py
------------------
Loads trained IsolationForest + StandardScaler and scores live 14-dim vectors.
"""

from __future__ import annotations

import json
import os
from typing import Optional, Tuple

import joblib
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANNOMOLY_DIR = os.path.join(BASE_DIR, "..", "annomoly")
MODEL_PATH = os.path.join(ANNOMOLY_DIR, "isolation_forest.joblib")
SCALER_PATH = os.path.join(ANNOMOLY_DIR, "scaler.joblib")
META_PATH = os.path.join(ANNOMOLY_DIR, "model_meta.json")

# Default order when meta is missing (matches FeatureVector schema)
DEFAULT_FEATURE_COLS = [
    "engineHoursPerDay",
    "idleHoursPerDay",
    "rentalDays",
    "hasOperator",
    "hasSite",
    "idleRatio",
]

_clf = None
_scaler = None
_meta: Optional[dict] = None


def load_model() -> bool:
    global _clf, _scaler, _meta

    if not os.path.exists(MODEL_PATH) or not os.path.exists(SCALER_PATH):
        return False

    _clf = joblib.load(MODEL_PATH)
    _scaler = joblib.load(SCALER_PATH)

    if os.path.exists(META_PATH):
        with open(META_PATH, encoding="utf-8") as f:
            _meta = json.load(f)
    else:
        _meta = {"feature_cols": DEFAULT_FEATURE_COLS, "feature_dim": 6}

    print(f"Isolation Forest model loaded from {MODEL_PATH}")
    if _meta:
        print(
            f"   Trained: {_meta.get('trained_at')} | "
            f"samples={_meta.get('n_samples')} | "
            f"trees={_meta.get('n_estimators')} | "
            f"dims={_meta.get('feature_dim')} | "
            f"contamination={_meta.get('contamination')}"
        )
        metrics = _meta.get("metrics") or {}
        if metrics:
            print(
                f"   Hold-out F1={metrics.get('f1')}  "
                f"P={metrics.get('precision')}  R={metrics.get('recall')}"
            )
    return True


def is_loaded() -> bool:
    return _clf is not None and _scaler is not None


def get_meta() -> Optional[dict]:
    return _meta


def reload_model() -> bool:
    global _clf, _scaler, _meta
    _clf = _scaler = _meta = None
    return load_model()


def _vector_from_payload(payload: dict | list[float]) -> np.ndarray:
    """
    Accept either:
      - list[float] of length feature_dim (already ordered)
      - dict with named feature keys (from FastAPI FeatureVector)
    """
    feature_cols = (_meta or {}).get("feature_cols") or DEFAULT_FEATURE_COLS
    dim = len(feature_cols)

    if isinstance(payload, list):
        if len(payload) != dim:
            # Legacy callers sometimes send 14-dim while model is 6-dim (or reverse)
            if len(payload) == 14 and dim == 6:
                return _map_14_to_legacy6(payload)
            raise ValueError(f"Expected {dim}-dim vector, got {len(payload)}")
        return np.array([payload], dtype=float)

    # dict path
    values = []
    for col in feature_cols:
        if col not in payload:
            raise ValueError(f"Missing feature '{col}' in payload")
        values.append(float(payload[col]))
    return np.array([values], dtype=float)


def _map_14_to_legacy6(vec: list[float]) -> np.ndarray:
    """Fallback only for old 6-dim models."""
    engine_hours = vec[1]
    idle_hours = vec[2]
    has_operator = vec[12]
    dist_site = vec[13]
    has_site = 0.0 if dist_site > 0.05 else 1.0
    total = engine_hours + idle_hours
    idle_ratio = idle_hours / total if total > 0 else 1.0
    return np.array([[engine_hours, idle_hours, 1.0, has_operator, has_site, idle_ratio]])


def score(feature_vector: list[float] | dict) -> Tuple[bool, float, str]:
    """
    Score a live feature vector.

    Returns:
        (is_anomaly, anomaly_score_0_to_1, confidence_label)
    """
    if not is_loaded():
        raise RuntimeError(
            "Isolation Forest model not loaded. "
            "POST /train first, or run: npm run ml:train"
        )

    X = _vector_from_payload(feature_vector)
    X_scaled = _scaler.transform(X)

    raw_score = float(_clf.decision_function(X_scaled)[0])

    # decision_function: higher = more normal.
    # Use tuned threshold from meta when available (else sklearn default 0.0).
    thr = float((_meta or {}).get("decision_threshold", 0.0))
    is_anomaly = raw_score < thr

    # Map to anomaly score in [0,1] relative to threshold (higher = more anomalous)
    # score≈0.5 at boundary; rises as decision_function drops below thr
    normalized = float(np.clip(0.5 + (thr - raw_score), 0.0, 1.0))

    if normalized >= 0.75:
        confidence = "HIGH"
    elif normalized >= 0.60:
        confidence = "MEDIUM"
    else:
        confidence = "LOW"

    return is_anomaly, round(normalized, 4), confidence
