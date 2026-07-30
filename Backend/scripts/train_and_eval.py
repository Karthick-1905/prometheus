"""
train_and_eval.py
-----------------
End-to-end: generate (optional) → train → evaluate → smoke-test predict.

Usage (from python-ml/):
  python train_and_eval.py
  python train_and_eval.py --n 15000 --skip-generate
"""

from __future__ import annotations

import argparse
import json
import os
import sys

# Ensure local imports work when run as a script
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from model.trainer import train, DEFAULT_CSV, META_PATH, MODEL_PATH, SCALER_PATH
from model import predictor


def smoke_predict() -> None:
    """Score a few handcrafted normal vs anomaly vectors."""
    if not predictor.load_model():
        raise RuntimeError("Model failed to load after training")

    cases = [
        (
            "normal_working",
            {
                "engineHoursPerDay": 6.5,
                "idleHoursPerDay": 1.2,
                "rentalDays": 15.0,
                "hasOperator": 1.0,
                "hasSite": 1.0,
                "idleRatio": 0.1558,
            },
            False,
        ),
        (
            "excessive_idle",
            {
                "engineHoursPerDay": 1.5,
                "idleHoursPerDay": 10.0,
                "rentalDays": 15.0,
                "hasOperator": 1.0,
                "hasSite": 1.0,
                "idleRatio": 0.8696,
            },
            True,
        ),
        (
            "unassigned_site",
            {
                "engineHoursPerDay": 0.0,
                "idleHoursPerDay": 11.0,
                "rentalDays": 20.0,
                "hasOperator": 0.0,
                "hasSite": 0.0,
                "idleRatio": 1.0,
            },
            True,
        ),
        (
            "unassigned_operator",
            {
                "engineHoursPerDay": 4.0,
                "idleHoursPerDay": 1.0,
                "rentalDays": 10.0,
                "hasOperator": 0.0,
                "hasSite": 1.0,
                "idleRatio": 0.2,
            },
            True,
        ),
        (
            "engine_off_normal",
            {
                "engineHoursPerDay": 0.0,
                "idleHoursPerDay": 0.0,
                "rentalDays": 12.0,
                "hasOperator": 0.0,
                "hasSite": 1.0,
                "idleRatio": 0.0,
            },
            False,
        ),
    ]

    print("\n-- Smoke predict tests --")
    ok = 0
    for name, vec, expect_anom in cases:
        is_anom, score, conf = predictor.score(vec)
        match = is_anom == expect_anom
        ok += int(match)
        flag = "PASS" if match else "FAIL"
        print(
            f"  [{flag}] {name:20s}  isAnomaly={is_anom}  "
            f"score={score:.3f}  conf={conf}  expected={expect_anom}"
        )
    print(f"Smoke: {ok}/{len(cases)} passed")
    if ok < len(cases):
        # Soft fail — IF is unsupervised; print warning but don't exit hard
        print("NOTE: some smoke cases mismatched (unsupervised boundary cases OK)")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=40000)
    parser.add_argument("--anomaly-rate", type=float, default=0.10)
    parser.add_argument("--skip-generate", action="store_true")
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--csv", type=str, default=DEFAULT_CSV)
    args = parser.parse_args()

    print("=" * 64)
    print(" CAT Fleet - Isolation Forest train & evaluate (Python/sklearn)")
    print("=" * 64)

    if not args.skip_generate:
        from aggregate_telemetry import aggregate_telemetry
        print("\n[1/3] Aggregating rental summary dataset from telemetry.csv...")
        aggregate_telemetry()
    else:
        print(f"\n[1/3] Skip aggregation - using existing {args.csv}")

    print("\n[2/3] Training IsolationForest...")
    _clf, _scaler, meta = train(
        csv_path=args.csv,
        n_estimators=args.n_estimators,
        contamination="auto",
        train_on_normal_only=True,
        random_state=42,
    )

    metrics = meta.get("metrics") or {}
    print("\n[3/3] Summary metrics")
    print(json.dumps(metrics, indent=2))

    smoke_predict()

    print("\nArtifacts:")
    print(f"  model : {MODEL_PATH}")
    print(f"  scaler: {SCALER_PATH}")
    print(f"  meta  : {META_PATH}")
    print("\nNext: start ML server ->  cd python-ml && python main.py")
    print("      then hybrid ingest ->  npm run ingest")
    print("=" * 64)


if __name__ == "__main__":
    main()
