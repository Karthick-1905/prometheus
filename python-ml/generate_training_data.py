"""
generate_training_data.py
-------------------------
Creates a high-quality labeled dataset for Isolation Forest training.

Output: ../annomoly/training-data.csv

Columns match the live 14-dim feature vector used by TypeScript ingestion
(plus labels for evaluation):

  fuelLevel, engineHours, idleHours, speed, engineTemperature,
  hydraulicPressure, batteryVoltage, loadPercentage, vibrationLevel,
  fuelDelta, engineHoursDelta, idleHoursDelta, engineOn,
  distanceFromSiteCenter, equipmentId, equipmentType, isAnomaly, anomalyReason

Also keeps legacy summary columns for compatibility:
  engineHoursPerDay, idleHoursPerDay, rentalDays, hasOperator, hasSite, idleRatio
"""

from __future__ import annotations

import argparse
import os
import random
from pathlib import Path

import numpy as np
import pandas as pd

RANDOM_SEED = 42
rng = np.random.default_rng(RANDOM_SEED)
random.seed(RANDOM_SEED)

EQUIPMENT_TYPES = [
    "Excavator",
    "Bulldozer",
    "Motor Grader",
    "Wheel Loader",
    "Backhoe Loader",
    "Skid Steer Loader",
    "Crane",
    "Asphalt Paver",
    "Compactor",
    "Dump Truck",
]

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

OUT_DIR = Path(__file__).resolve().parent.parent / "annomoly"
OUT_CSV = OUT_DIR / "training-data.csv"


def _clip(v: float, lo: float, hi: float) -> float:
    return float(np.clip(v, lo, hi))


def normal_sample(eq_type: str, eq_id: str) -> dict:
    """Realistic normal CAT machine operating envelope."""
    engine_on = 1.0 if rng.random() < 0.72 else 0.0

    if engine_on:
        fuel = rng.uniform(25, 95)
        speed = rng.uniform(0, 18)
        temp = rng.normal(82, 6)
        hyd = rng.normal(155, 18)
        load = rng.uniform(25, 85)
        vib = rng.uniform(0.8, 6.5)
        fuel_delta = abs(rng.normal(0.4, 0.25))
        eng_delta = abs(rng.normal(0.08, 0.03))
        idle_delta = abs(rng.normal(0.02, 0.015))
        eng_hrs_day = rng.uniform(4.0, 9.0)
        idle_hrs_day = rng.uniform(0.3, 3.0)
    else:
        fuel = rng.uniform(20, 98)
        speed = 0.0
        temp = rng.uniform(20, 45)
        hyd = rng.uniform(0, 20)
        load = 0.0
        vib = rng.uniform(0, 0.5)
        fuel_delta = abs(rng.normal(0.05, 0.05))
        eng_delta = 0.0
        idle_delta = 0.0
        eng_hrs_day = rng.uniform(0.0, 2.0)
        idle_hrs_day = rng.uniform(0.0, 2.0)

    engine_hours = rng.uniform(200, 4500)
    idle_hours = engine_hours * rng.uniform(0.08, 0.35)
    battery = rng.normal(13.4, 0.35)
    dist = abs(rng.normal(0.005, 0.008))
    rental_days = int(rng.integers(5, 45))
    has_operator = 1 if engine_on or rng.random() < 0.85 else 0
    has_site = 1 if rng.random() < 0.9 else 0
    total = eng_hrs_day + idle_hrs_day
    idle_ratio = idle_hrs_day / total if total > 0 else 0.0

    return {
        "fuelLevel": _clip(fuel, 0, 100),
        "engineHours": round(engine_hours, 2),
        "idleHours": round(idle_hours, 2),
        "speed": round(max(0, speed), 2),
        "engineTemperature": round(_clip(temp, 15, 104), 1),
        "hydraulicPressure": round(max(0, hyd), 1),
        "batteryVoltage": round(_clip(battery, 11.5, 14.8), 2),
        "loadPercentage": round(_clip(load, 0, 100), 1),
        "vibrationLevel": round(max(0, vib), 2),
        "fuelDelta": round(_clip(fuel_delta, 0, 8), 2),
        "engineHoursDelta": round(_clip(eng_delta, 0, 0.5), 3),
        "idleHoursDelta": round(_clip(idle_delta, 0, 0.5), 3),
        "engineOn": engine_on,
        "distanceFromSiteCenter": round(_clip(dist, 0, 0.04), 5),
        "equipmentId": eq_id,
        "equipmentType": eq_type,
        "engineHoursPerDay": round(eng_hrs_day, 2),
        "idleHoursPerDay": round(idle_hrs_day, 2),
        "rentalDays": rental_days,
        "hasOperator": has_operator,
        "hasSite": has_site,
        "idleRatio": round(idle_ratio, 4),
        "isAnomaly": 0,
        "anomalyReason": "",
    }


def anomaly_sample(eq_type: str, eq_id: str, kind: str) -> dict:
    """
    Inject a strong multi-feature outlier for Isolation Forest.

    Single-sensor glitches are mostly handled by rule-based detection.
    IF needs several dimensions outside the normal envelope at once.
    """
    row = normal_sample(eq_type, eq_id)
    row["isAnomaly"] = 1
    row["engineOn"] = 1.0

    if kind == "ENGINE_OVERHEAT":
        row["engineTemperature"] = round(rng.uniform(108, 118), 1)
        row["loadPercentage"] = round(rng.uniform(85, 100), 1)
        row["vibrationLevel"] = round(rng.uniform(10, 18), 2)
        row["hydraulicPressure"] = round(rng.uniform(200, 260), 1)
        row["fuelDelta"] = round(rng.uniform(3, 8), 2)
        row["anomalyReason"] = "ENGINE_OVERHEAT"
    elif kind == "SEVERE_VIBRATION":
        row["vibrationLevel"] = round(rng.uniform(18, 28), 2)
        row["loadPercentage"] = round(rng.uniform(92, 100), 1)
        row["engineTemperature"] = round(rng.uniform(95, 110), 1)
        row["hydraulicPressure"] = round(rng.uniform(190, 250), 1)
        row["speed"] = round(rng.uniform(0, 4), 2)
        row["anomalyReason"] = "SEVERE_VIBRATION"
    elif kind == "FUEL_LEAK_THEFT":
        row["fuelDelta"] = round(rng.uniform(14, 28), 2)
        row["fuelLevel"] = round(rng.uniform(2, 25), 1)
        row["speed"] = 0.0
        row["engineHoursDelta"] = round(rng.uniform(0, 0.02), 3)
        row["idleHoursDelta"] = round(rng.uniform(0.5, 1.5), 3)
        row["anomalyReason"] = "FUEL_LEAK_THEFT"
    elif kind == "EXCESSIVE_IDLE":
        row["idleHoursDelta"] = round(rng.uniform(1.5, 3.0), 3)
        row["speed"] = 0.0
        row["loadPercentage"] = round(rng.uniform(0, 8), 1)
        row["fuelDelta"] = round(rng.uniform(1.5, 4.0), 2)
        row["engineTemperature"] = round(rng.uniform(70, 95), 1)
        row["idleHoursPerDay"] = round(rng.uniform(10, 14), 2)
        row["engineHoursPerDay"] = round(rng.uniform(0, 1.2), 2)
        total = row["engineHoursPerDay"] + row["idleHoursPerDay"]
        row["idleRatio"] = round(row["idleHoursPerDay"] / total, 4)
        row["anomalyReason"] = "EXCESSIVE_IDLE"
    elif kind == "LOW_BATTERY":
        row["batteryVoltage"] = round(rng.uniform(7.5, 10.5), 2)
        row["engineOn"] = float(rng.integers(0, 2))
        row["speed"] = 0.0 if row["engineOn"] == 0 else round(rng.uniform(0, 3), 2)
        row["loadPercentage"] = round(rng.uniform(0, 20), 1)
        row["anomalyReason"] = "LOW_BATTERY"
    elif kind == "GEOFENCE_VIOLATION":
        row["distanceFromSiteCenter"] = round(rng.uniform(0.12, 0.45), 5)
        row["hasSite"] = 0
        row["speed"] = round(rng.uniform(15, 40), 2)
        row["engineOn"] = 1.0
        row["anomalyReason"] = "GEOFENCE_VIOLATION"
    elif kind == "ENGINE_HOURS_TAMPER":
        row["engineHoursDelta"] = round(rng.uniform(2.0, 6.0), 3)
        row["idleHoursDelta"] = round(rng.uniform(0, 0.05), 3)
        row["fuelDelta"] = round(rng.uniform(0, 0.2), 2)
        row["speed"] = 0.0
        row["anomalyReason"] = "ENGINE_HOURS_TAMPER"
    elif kind == "UNASSIGNED_OPERATOR":
        row["hasOperator"] = 0
        row["engineOn"] = 1.0
        row["speed"] = round(rng.uniform(5, 18), 2)
        row["loadPercentage"] = round(rng.uniform(40, 90), 1)
        row["distanceFromSiteCenter"] = round(rng.uniform(0.06, 0.2), 5)
        row["anomalyReason"] = "UNASSIGNED_OPERATOR"
    elif kind == "UNASSIGNED_SITE":
        row["hasSite"] = 0
        row["hasOperator"] = 0
        row["engineHoursPerDay"] = 0.0
        row["idleHoursPerDay"] = round(rng.uniform(10, 14), 2)
        row["idleRatio"] = 1.0
        row["engineOn"] = 0.0
        row["speed"] = 0.0
        row["idleHoursDelta"] = round(rng.uniform(1.0, 2.5), 3)
        row["distanceFromSiteCenter"] = round(rng.uniform(0.1, 0.4), 5)
        row["anomalyReason"] = "UNASSIGNED_SITE"
    else:  # STATISTICAL_MIX — multi-sensor weirdness
        row["engineTemperature"] = round(rng.uniform(105, 118), 1)
        row["vibrationLevel"] = round(rng.uniform(15, 24), 2)
        row["fuelDelta"] = round(rng.uniform(10, 20), 2)
        row["batteryVoltage"] = round(rng.uniform(8.5, 10.8), 2)
        row["loadPercentage"] = round(rng.uniform(90, 100), 1)
        row["distanceFromSiteCenter"] = round(rng.uniform(0.08, 0.25), 5)
        row["anomalyReason"] = "STATISTICAL_MIX"

    total = row["engineHoursPerDay"] + row["idleHoursPerDay"]
    if total > 0:
        row["idleRatio"] = round(row["idleHoursPerDay"] / total, 4)

    return row


ANOMALY_KINDS = [
    "ENGINE_OVERHEAT",
    "SEVERE_VIBRATION",
    "FUEL_LEAK_THEFT",
    "EXCESSIVE_IDLE",
    "LOW_BATTERY",
    "GEOFENCE_VIOLATION",
    "ENGINE_HOURS_TAMPER",
    "UNASSIGNED_OPERATOR",
    "UNASSIGNED_SITE",
    "STATISTICAL_MIX",
]


def generate(n_samples: int = 10000, anomaly_rate: float = 0.10) -> pd.DataFrame:
    n_anom = int(n_samples * anomaly_rate)
    n_normal = n_samples - n_anom
    rows: list[dict] = []

    for i in range(n_normal):
        eq_type = random.choice(EQUIPMENT_TYPES)
        eq_id = f"CAT-{eq_type[:2].upper()}-{1000 + (i % 500)}"
        rows.append(normal_sample(eq_type, eq_id))

    for i in range(n_anom):
        eq_type = random.choice(EQUIPMENT_TYPES)
        eq_id = f"CAT-{eq_type[:2].upper()}-{2000 + (i % 300)}"
        kind = ANOMALY_KINDS[i % len(ANOMALY_KINDS)]
        rows.append(anomaly_sample(eq_type, eq_id, kind))

    rng.shuffle(rows)
    df = pd.DataFrame(rows)

    # column order
    cols = (
        FEATURE_COLS_14
        + [
            "equipmentId",
            "equipmentType",
            "engineHoursPerDay",
            "idleHoursPerDay",
            "rentalDays",
            "hasOperator",
            "hasSite",
            "idleRatio",
            "isAnomaly",
            "anomalyReason",
        ]
    )
    return df[cols]


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Isolation Forest training CSV")
    parser.add_argument("--n", type=int, default=10000, help="Total samples (default 10000)")
    parser.add_argument(
        "--anomaly-rate",
        type=float,
        default=0.10,
        help="Fraction of labeled anomalies (default 0.10)",
    )
    parser.add_argument(
        "--out",
        type=str,
        default=str(OUT_CSV),
        help="Output CSV path",
    )
    args = parser.parse_args()

    print("=" * 60)
    print(" CAT Fleet — Training Data Generator")
    print("=" * 60)
    print(f"Samples:      {args.n:,}")
    print(f"Anomaly rate: {args.anomaly_rate:.0%}")
    print(f"Output:       {args.out}")

    df = generate(n_samples=args.n, anomaly_rate=args.anomaly_rate)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)

    n_a = int(df["isAnomaly"].sum())
    print(f"\nWrote {len(df):,} rows → {out_path}")
    print(f"  Normal:   {len(df) - n_a:,}")
    print(f"  Anomaly:  {n_a:,} ({n_a / len(df):.1%})")
    print("\nAnomaly type breakdown:")
    print(df.loc[df["isAnomaly"] == 1, "anomalyReason"].value_counts().to_string())
    print("\nFeature means (normal vs anomaly):")
    for col in ["engineTemperature", "vibrationLevel", "fuelDelta", "batteryVoltage", "distanceFromSiteCenter"]:
        n_mean = df.loc[df["isAnomaly"] == 0, col].mean()
        a_mean = df.loc[df["isAnomaly"] == 1, col].mean()
        print(f"  {col:28s}  normal={n_mean:8.3f}  anomaly={a_mean:8.3f}")
    print("=" * 60)


if __name__ == "__main__":
    main()
