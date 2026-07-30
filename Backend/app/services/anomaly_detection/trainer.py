"""Train Isolation Forest and persist to Backend/artifacts/."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
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

from app.config import get_settings

FEATURE_COLS_LEGACY = [
    "engineHoursPerDay",
    "idleHoursPerDay",
    "rentalDays",
    "hasOperator",
    "hasSite",
    "idleRatio",
]


def _artifacts() -> Path:
    return Path(get_settings().artifacts_dir)


def default_csv_path() -> Path:
    return _artifacts() / "training-data.csv"


def model_path() -> Path:
    return _artifacts() / "isolation_forest.joblib"


def scaler_path() -> Path:
    return _artifacts() / "scaler.joblib"


def meta_path() -> Path:
    return _artifacts() / "model_meta.json"


def train(
    csv_path: Optional[str] = None,
    n_estimators: int = 200,
    contamination: float | str = "auto",
    max_samples: Optional[int | str] = "auto",
    random_state: int = 42,
    test_size: float = 0.2,
    train_on_normal_only: bool = True,
) -> Tuple[IsolationForest, StandardScaler, dict]:
    t0 = time.time()
    path = Path(csv_path) if csv_path else default_csv_path()
    if not path.exists():
        raise FileNotFoundError(f"Training CSV not found: {path}")

    df = pd.read_csv(path)
    if not all(c in df.columns for c in FEATURE_COLS_LEGACY):
        missing = [c for c in FEATURE_COLS_LEGACY if c not in df.columns]
        raise ValueError(f"CSV missing columns: {missing}")

    feature_cols = FEATURE_COLS_LEGACY
    X_all = df[feature_cols].fillna(0).astype(float).values
    y_all = df["isAnomaly"].astype(int).values if "isAnomaly" in df.columns else None

    if y_all is not None and len(df) >= 50:
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X_all, y_all, test_size=test_size, random_state=random_state, stratify=y_all
            )
        except ValueError:
            X_train, X_test, y_train, y_test = train_test_split(
                X_all, y_all, test_size=test_size, random_state=random_state
            )
    else:
        X_train, X_test, y_train, y_test = X_all, X_all, y_all, y_all

    if train_on_normal_only and y_train is not None:
        normal_mask = y_train == 0
        if normal_mask.sum() < 20:
            raise ValueError("Not enough normal samples to train")
        X_fit = X_train[normal_mask]
        fit_contamination = 0.02 if contamination == "auto" else contamination
    else:
        X_fit = X_train
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

    decision_threshold = 0.0
    metrics: dict = {}
    if y_test is not None:
        n_half = max(1, len(X_test) // 2)
        X_val, X_hold = X_test_scaled[:n_half], X_test_scaled[n_half:]
        y_val, y_hold = y_test[:n_half], y_test[n_half:]
        val_scores = clf.decision_function(X_val)
        best_f1, best_thr = -1.0, 0.0
        for thr in np.unique(np.quantile(val_scores, np.linspace(0.02, 0.55, 40))):
            y_hat_val = (val_scores < thr).astype(int)
            f1 = f1_score(y_val, y_hat_val, zero_division=0)
            if f1 > best_f1:
                best_f1, best_thr = f1, float(thr)
        decision_threshold = best_thr
        hold_scores = clf.decision_function(X_hold)
        y_hat = (hold_scores < decision_threshold).astype(int)
        metrics = {
            "precision": round(float(precision_score(y_hold, y_hat, zero_division=0)), 4),
            "recall": round(float(recall_score(y_hold, y_hat, zero_division=0)), 4),
            "f1": round(float(f1_score(y_hold, y_hat, zero_division=0)), 4),
            "accuracy": round(float(accuracy_score(y_hold, y_hat)), 4),
            "confusion_matrix": confusion_matrix(y_hold, y_hat).tolist(),
            "n_test": int(len(y_hold)),
            "n_test_anomalies": int(y_hold.sum()),
            "n_predicted_anomalies": int(y_hat.sum()),
            "decision_threshold": decision_threshold,
        }
        print(classification_report(y_hold, y_hat, target_names=["normal", "anomaly"], digits=4))

    elapsed_ms = (time.time() - t0) * 1000
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
        "csv_path": str(path.resolve()),
        "anomaly_rate_pct": round(float(y_all.mean() * 100), 2) if y_all is not None else None,
        "metrics": metrics,
    }

    art = _artifacts()
    art.mkdir(parents=True, exist_ok=True)
    joblib.dump(clf, model_path())
    joblib.dump(scaler, scaler_path())
    with open(meta_path(), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print(f"Saved model → {model_path()}")
    return clf, scaler, meta
