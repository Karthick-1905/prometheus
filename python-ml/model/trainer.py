"""
model/trainer.py
----------------
Trains scikit-learn IsolationForest on the 14-dim live feature space
(matching TypeScript buildFeatureVector) and persists model + scaler.
"""

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from typing import Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ── Paths ─────────────────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANNOMOLY_DIR = os.path.join(BASE_DIR, "..", "annomoly")
DEFAULT_CSV = os.path.join(ANNOMOLY_DIR, "training-data.csv")
MODEL_PATH = os.path.join(ANNOMOLY_DIR, "isolation_forest.joblib")
SCALER_PATH = os.path.join(ANNOMOLY_DIR, "scaler.joblib")
META_PATH = os.path.join(ANNOMOLY_DIR, "model_meta.json")

# Live 14-dim feature space (preferred — matches MLClient /predict body)
FEATURE_COLS_14 = [
    "fuelLevel",
    "engineHours",
    "idleHours",
    "speed",
    "engineTemperature",
    "hydraulicPressure",
    "batteryVoltage",
    "loadPercentage",
    "vibrationLevel",
    "fuelDelta",
    "engineHoursDelta",
    "idleHoursDelta",
    "engineOn",
    "distanceFromSiteCenter",
]

# Legacy 6-dim rental summary (older training-data.csv)
FEATURE_COLS_LEGACY = [
    "engineHoursPerDay",
    "idleHoursPerDay",
    "rentalDays",
    "hasOperator",
    "hasSite",
    "idleRatio",
]


def _resolve_feature_cols(df: pd.DataFrame) -> list[str]:
    if all(c in df.columns for c in FEATURE_COLS_14):
        return FEATURE_COLS_14
    if all(c in df.columns for c in FEATURE_COLS_LEGACY):
        print("WARNING: Using legacy 6-dim features. Regenerate CSV with generate_training_data.py")
        return FEATURE_COLS_LEGACY
    raise ValueError(
        "CSV must contain either 14-dim live features or legacy 6-dim summary columns.\n"
        f"Missing 14-dim: {[c for c in FEATURE_COLS_14 if c not in df.columns]}\n"
        f"Missing legacy: {[c for c in FEATURE_COLS_LEGACY if c not in df.columns]}"
    )


def _load_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Training CSV not found: {csv_path}\n"
            f"Run: python generate_training_data.py   (from python-ml/)\n"
            f"  or: npm run ml:generate"
        )
    return pd.read_csv(csv_path)


def train(
    csv_path: str = DEFAULT_CSV,
    n_estimators: int = 200,
    contamination: float | str = "auto",
    max_samples: Optional[int | str] = "auto",
    random_state: int = 42,
    test_size: float = 0.2,
    train_on_normal_only: bool = True,
) -> Tuple[IsolationForest, StandardScaler, dict]:
    """
    Train Isolation Forest and evaluate against labeled hold-out if isAnomaly exists.

    train_on_normal_only:
        If True and labels exist, fit only on normal rows (novelty detection)
        then score the mixed test set. Usually much better for labeled synthetic data.
    """
    t0 = time.time()
    df = _load_csv(csv_path)
    feature_cols = _resolve_feature_cols(df)
    X_all = df[feature_cols].fillna(0).astype(float).values
    y_all = df["isAnomaly"].astype(int).values if "isAnomaly" in df.columns else None

    # Split before fit so evaluation is honest
    if y_all is not None and len(df) >= 50:
        X_train, X_test, y_train, y_test = train_test_split(
            X_all,
            y_all,
            test_size=test_size,
            random_state=random_state,
            stratify=y_all,
        )
    else:
        X_train, X_test, y_train, y_test = X_all, X_all, y_all, y_all

    if train_on_normal_only and y_train is not None:
        normal_mask = y_train == 0
        if normal_mask.sum() < 20:
            raise ValueError("Not enough normal samples to train novelty detector")
        X_fit = X_train[normal_mask]
        # With normal-only training, set a small contamination for residual noise
        fit_contamination = 0.02 if contamination == "auto" else contamination
    else:
        X_fit = X_train
        if contamination == "auto" and y_train is not None:
            rate = float(y_train.mean())
            fit_contamination = float(np.clip(rate, 0.01, 0.5))
        else:
            fit_contamination = contamination if contamination != "auto" else 0.1

    scaler = StandardScaler()
    X_fit_scaled = scaler.fit_transform(X_fit)
    X_test_scaled = scaler.transform(X_test)

    clf = IsolationForest(
        n_estimators=n_estimators,
        contamination=fit_contamination,
        max_samples=max_samples if max_samples is not None else "auto",
        random_state=random_state,
        n_jobs=-1,
    )
    clf.fit(X_fit_scaled)

    # Tune decision_function threshold on a labeled validation slice for best F1.
    # sklearn.predict uses contamination quantile; threshold search is stronger
    # when we have isAnomaly labels in the synthetic set.
    decision_threshold = 0.0  # default: decision_function < 0 → anomaly
    if y_test is not None:
        # Use half of test as val for threshold, half for final report
        n_half = max(1, len(X_test) // 2)
        X_val, X_hold = X_test_scaled[:n_half], X_test_scaled[n_half:]
        y_val, y_hold = y_test[:n_half], y_test[n_half:]

        val_scores = clf.decision_function(X_val)
        best_f1, best_thr = -1.0, 0.0
        # Search thresholds between 5th and 50th percentile of val scores
        candidates = np.unique(np.quantile(val_scores, np.linspace(0.02, 0.55, 40)))
        for thr in candidates:
            y_hat_val = (val_scores < thr).astype(int)
            f1 = f1_score(y_val, y_hat_val, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_thr = float(thr)
        decision_threshold = best_thr
        print(f"Tuned decision_threshold={decision_threshold:.4f} (val F1={best_f1:.4f})")

        hold_scores = clf.decision_function(X_hold)
        y_hat = (hold_scores < decision_threshold).astype(int)
        y_eval = y_hold
    else:
        y_hat = None
        y_eval = None

    elapsed_ms = (time.time() - t0) * 1000

    metrics: dict = {}
    if y_eval is not None and y_hat is not None:
        metrics = {
            "precision": round(float(precision_score(y_eval, y_hat, zero_division=0)), 4),
            "recall": round(float(recall_score(y_eval, y_hat, zero_division=0)), 4),
            "f1": round(float(f1_score(y_eval, y_hat, zero_division=0)), 4),
            "accuracy": round(float(accuracy_score(y_eval, y_hat)), 4),
            "confusion_matrix": confusion_matrix(y_eval, y_hat).tolist(),
            "n_test": int(len(y_eval)),
            "n_test_anomalies": int(y_eval.sum()),
            "n_predicted_anomalies": int(y_hat.sum()),
            "decision_threshold": decision_threshold,
        }

        print("\n-- Hold-out evaluation (isAnomaly labels) --")
        print(classification_report(y_eval, y_hat, target_names=["normal", "anomaly"], digits=4))
        print("Confusion matrix [[TN FP],[FN TP]]:")
        print(np.array(metrics["confusion_matrix"]))

    meta = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": int(len(X_fit)),
        "n_train_rows": int(len(X_train)),
        "n_estimators": n_estimators,
        "contamination": fit_contamination,
        "decision_threshold": decision_threshold,
        "max_samples": max_samples if max_samples is not None else "auto",
        "random_state": random_state,
        "feature_cols": feature_cols,
        "feature_dim": len(feature_cols),
        "train_on_normal_only": train_on_normal_only and y_train is not None,
        "training_time_ms": round(elapsed_ms, 2),
        "csv_path": os.path.abspath(csv_path),
        "anomaly_rate_pct": round(float(y_all.mean() * 100), 2) if y_all is not None else None,
        "metrics": metrics,
    }

    os.makedirs(ANNOMOLY_DIR, exist_ok=True)
    joblib.dump(clf, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(
        f"\nModel trained in {elapsed_ms:.0f}ms | fit_samples={len(X_fit)} | "
        f"trees={n_estimators} | contamination={fit_contamination} | dims={len(feature_cols)}"
    )
    print(f"Saved: {MODEL_PATH}")
    print(f"Saved: {SCALER_PATH}")
    print(f"Saved: {META_PATH}")

    return clf, scaler, meta
