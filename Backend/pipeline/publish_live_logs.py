#!/usr/bin/env python3
"""
publish_live_logs.py
--------------------
Demo publisher: pushes machinery telemetry through IngestionService so events
appear on Redis (telemetry:events) and on the Fleet Live Logs SSE stream.

Uses seeded equipment IDs when possible. Does not require MQTT.

Usage (Backend/):
  make up
  make run-api          # terminal A
  make run-live-logs    # terminal B
  # open Frontend → Fleet → Live Telemetry → Live logs
"""
from __future__ import annotations

import os
import random
import sys
import time
from datetime import datetime
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.db.session import SessionLocal
from app.models.domain import Equipment
from app.services.ingestion.service import IngestionService
from app.services.redis_bus import redis_status
from sqlalchemy import select

INTERVAL = float(os.getenv("LIVE_LOG_INTERVAL_SEC", "1.0"))
rng = random.Random()


def load_equipment_ids(db) -> list[tuple[int, str]]:
    rows = db.execute(select(Equipment.equipment_id, Equipment.equipment_type).limit(40)).all()
    if rows:
        return [(int(r[0]), r[1] or "Excavator") for r in rows]
    return [(i, t) for i, t in enumerate(
        ["Excavator", "Bulldozer", "Crane", "Wheel Loader", "Dump Truck"] * 4, start=1
    )]


def sample_payload(eq_id: int, eq_type: str) -> dict:
    eng_on = rng.random() < 0.75
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "equipmentId": str(eq_id),
        "equipmentType": eq_type,
        "siteId": str(rng.randint(1, 6)),
        "operatorId": f"OP-{rng.randint(100, 120)}" if eng_on else None,
        "engineStatus": "ON" if eng_on else "OFF",
        "fuelLevel": round(rng.uniform(20, 95), 1),
        "engineHours": round(rng.uniform(500, 3000), 1),
        "idleHours": round(rng.uniform(50, 400), 1),
        "speed": round(rng.uniform(0, 16), 1) if eng_on else 0.0,
        "latitude": round(37.7 + rng.random() * 0.1, 6),
        "longitude": round(-122.5 + rng.random() * 0.1, 6),
        "engineTemperature": round(rng.uniform(70, 112), 1) if eng_on else round(rng.uniform(30, 55), 1),
        "hydraulicPressure": round(rng.uniform(120, 200), 1),
        "batteryVoltage": round(rng.uniform(11.0, 14.2), 2),
        "loadPercentage": round(rng.uniform(10, 95), 1) if eng_on else 0.0,
        "vibrationLevel": round(rng.uniform(0.5, 16), 2),
        "rentalStatus": "Working",
    }


def main() -> int:
    print("=" * 60)
    print(" Live log publisher → IngestionService → Redis → SSE")
    print("=" * 60)
    status = redis_status()
    print(f"Redis: {status}")
    if not status.get("ok"):
        print("WARNING: Redis not reachable. Start with: make up")
        print("Events will still try to ingest to DB, but live SSE redis channel will be empty.")

    db = SessionLocal()
    try:
        fleet = load_equipment_ids(db)
        print(f"Equipment samples: {len(fleet)}  interval={INTERVAL}s")
        print("Publishing… Ctrl+C to stop")
        i = 0
        while True:
            eq_id, eq_type = fleet[i % len(fleet)]
            payload = sample_payload(eq_id, eq_type)
            result = IngestionService.process(db, payload)
            print(
                f"[{i}] eq={eq_id} type={eq_type} "
                f"stored={result.get('stored')} redis={result.get('redisPublished')} "
                f"alerts={result.get('alertCount', 0)} "
                f"temp={payload['engineTemperature']}"
            )
            i += 1
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
