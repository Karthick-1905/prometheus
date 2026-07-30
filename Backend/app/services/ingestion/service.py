"""Telemetry ingestion + optional usage log snapshot."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.domain import EquipmentTelemetry
from app.services.anomaly_detection.service import AnomalyDetectionService


class IngestionService:
    @staticmethod
    def process(db: Session, telemetry: dict[str, Any]) -> dict[str, Any]:
        ts = telemetry.get("timestamp") or datetime.utcnow()
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)

        eq_raw = str(telemetry.get("equipmentId", "0"))
        digits = "".join(ch for ch in eq_raw if ch.isdigit())
        equipment_id = int(digits) if digits else 1

        # Best-effort telemetry insert (FK may fail if equipment id not in DB)
        row = None
        try:
            row = EquipmentTelemetry(
                equipment_id=equipment_id,
                timestamp=ts,
                engine_status=telemetry.get("engineStatus"),
                fuel_level=_dec(telemetry.get("fuelLevel")),
                engine_hours=_dec(telemetry.get("engineHours")),
                idle_hours=_dec(telemetry.get("idleHours")),
                speed=_dec(telemetry.get("speed")),
                latitude=_dec(telemetry.get("latitude")),
                longitude=_dec(telemetry.get("longitude")),
                engine_temperature=_dec(telemetry.get("engineTemperature")),
                hydraulic_pressure=_dec(telemetry.get("hydraulicPressure")),
                battery_voltage=_dec(telemetry.get("batteryVoltage")),
                load_percentage=_dec(telemetry.get("loadPercentage")),
                vibration_level=_dec(telemetry.get("vibrationLevel")),
                rental_status=telemetry.get("rentalStatus"),
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            stored = True
            store_error = None
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            stored = False
            store_error = str(exc)

        alerts = []
        try:
            alerts = AnomalyDetectionService.detect_and_record(db, telemetry)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            return {
                "success": True,
                "stored": stored,
                "storeError": store_error,
                "alerts": [],
                "anomalyError": str(exc),
                "equipmentId": equipment_id,
            }

        return {
            "success": True,
            "stored": stored,
            "storeError": store_error,
            "equipmentId": equipment_id,
            "alertCount": len(alerts),
            "alerts": [
                {
                    "alertId": a.alert_id,
                    "anomalyType": a.anomaly_type.value if a.anomaly_type else None,
                    "severity": a.severity.value if a.severity else None,
                    "description": a.description,
                }
                for a in alerts
            ],
        }


def _dec(v: Any) -> Decimal | None:
    if v is None:
        return None
    return Decimal(str(v))
