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
                "fuelLevel": 72,
                "engineHours": 1200,
                "idleHours": 250,
                "speed": 8,
                "engineTemperature": 84,
                "hydraulicPressure": 160,
                "batteryVoltage": 13.6,
                "loadPercentage": 55,
                "vibrationLevel": 3.2,
                "fuelDelta": 0.4,
                "engineHoursDelta": 0.08,
                "idleHoursDelta": 0.02,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.004,
            },
            False,
        ),
        (
            "overheat",
            {
                "fuelLevel": 60,
                "engineHours": 1300,
                "idleHours": 280,
                "speed": 5,
                "engineTemperature": 114,
                "hydraulicPressure": 230,
                "batteryVoltage": 13.2,
                "loadPercentage": 96,
                "vibrationLevel": 14.0,
                "fuelDelta": 5.5,
                "engineHoursDelta": 0.09,
                "idleHoursDelta": 0.01,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.003,
            },
            True,
        ),
        (
            "fuel_theft",
            {
                "fuelLevel": 20,
                "engineHours": 1400,
                "idleHours": 300,
                "speed": 0,
                "engineTemperature": 80,
                "hydraulicPressure": 150,
                "batteryVoltage": 13.5,
                "loadPercentage": 10,
                "vibrationLevel": 1.5,
                "fuelDelta": 18.0,
                "engineHoursDelta": 0.02,
                "idleHoursDelta": 0.05,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.002,
            },
            True,
        ),
        (
            "severe_vibration",
            {
                "fuelLevel": 55,
                "engineHours": 900,
                "idleHours": 180,
                "speed": 2,
                "engineTemperature": 102,
                "hydraulicPressure": 220,
                "batteryVoltage": 13.1,
                "loadPercentage": 98,
                "vibrationLevel": 24.0,
                "fuelDelta": 1.2,
                "engineHoursDelta": 0.07,
                "idleHoursDelta": 0.01,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.005,
            },
            True,
        ),
        (
            "engine_off_normal",
            {
                "fuelLevel": 80,
                "engineHours": 1100,
                "idleHours": 220,
                "speed": 0,
                "engineTemperature": 28,
                "hydraulicPressure": 5,
                "batteryVoltage": 12.8,
                "loadPercentage": 0,
                "vibrationLevel": 0.1,
                "fuelDelta": 0.0,
                "engineHoursDelta": 0.0,
                "idleHoursDelta": 0.0,
                "engineOn": 0,
                "distanceFromSiteCenter": 0.001,
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
    parser.add_argument("--n", type=int, default=10000)
    parser.add_argument("--anomaly-rate", type=float, default=0.10)
    parser.add_argument("--skip-generate", action="store_true")
    parser.add_argument("--n-estimators", type=int, default=200)
    parser.add_argument("--csv", type=str, default=DEFAULT_CSV)
    args = parser.parse_args()

    print("=" * 64)
    print(" CAT Fleet - Isolation Forest train & evaluate (Python/sklearn)")
    print("=" * 64)

    if not args.skip_generate:
        from generate_training_data import generate
        import pandas as pd

        print(f"\n[1/3] Generating {args.n:,} training rows...")
        df = generate(n_samples=args.n, anomaly_rate=args.anomaly_rate)
        os.makedirs(os.path.dirname(os.path.abspath(args.csv)), exist_ok=True)
        df.to_csv(args.csv, index=False)
        print(f"      Wrote {args.csv}  ({len(df):,} rows, anomalies={int(df['isAnomaly'].sum())})")
    else:
        print(f"\n[1/3] Skip generate - using existing {args.csv}")

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
