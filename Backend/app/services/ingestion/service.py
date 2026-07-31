"""Telemetry ingestion + Redis live-log publish + anomaly detection."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.models.domain import EquipmentTelemetry
from app.services.anomaly_detection.service import AnomalyDetectionService
from app.services.geofencing import GeofencingService, geofence_batch_service
from app.services.redis_bus import publish_live_event


class IngestionService:
    @staticmethod
    def process(db: Session, telemetry: dict[str, Any]) -> dict[str, Any]:
        ts = telemetry.get("timestamp") or datetime.utcnow()
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)

        eq_raw = str(telemetry.get("equipmentId", "0"))
        digits = "".join(ch for ch in eq_raw if ch.isdigit())
        equipment_id = int(digits) if digits else 1
        equipment_type = telemetry.get("equipmentType")
        site_id = telemetry.get("siteId")

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

        geofence = GeofencingService.evaluate(
            db,
            telemetry,
            equipment_id=equipment_id,
        )
        enriched_telemetry = {
            **telemetry,
            "siteId": geofence.get("siteId") or telemetry.get("siteId"),
            "distanceFromSiteCenterMeters": geofence.get("distanceMeters"),
            "geofenceRadiusMeters": geofence.get("radiusMeters"),
            "isInsideGeofence": geofence.get("isAtSite"),
            "geofenceStatus": geofence.get("status"),
        }
        geofence_batch_published = geofence_batch_service.add(geofence)

        alerts = []
        anomaly_error = None
        try:
            alerts = AnomalyDetectionService.detect_and_record(db, enriched_telemetry)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            anomaly_error = str(exc)

        alert_payloads = [
            {
                "alertId": a.alert_id,
                "anomalyType": a.anomaly_type.value if a.anomaly_type else None,
                "severity": a.severity.value if a.severity else None,
                "description": a.description,
            }
            for a in alerts
        ]

        # Live log bus (Redis pub/sub) — powers Fleet Live Logs SSE
        redis_ok = publish_live_event(
            {
                "type": "TELEMETRY_RECEIVED",
                "equipmentId": str(eq_raw),
                "equipmentType": equipment_type,
                "siteId": str(site_id) if site_id is not None else None,
                "operatorId": telemetry.get("operatorId"),
                "companyId": geofence.get("companyId"),
                "message": (
                    f"Telemetry {eq_raw}"
                    f" engine={telemetry.get('engineStatus')}"
                    f" temp={telemetry.get('engineTemperature')}"
                    f" fuel={telemetry.get('fuelLevel')}"
                    f" speed={telemetry.get('speed')}"
                ),
                "stored": stored,
                "storeError": store_error,
                "telemetry": {
                    "engineStatus": telemetry.get("engineStatus"),
                    "fuelLevel": telemetry.get("fuelLevel"),
                    "engineHours": telemetry.get("engineHours"),
                    "idleHours": telemetry.get("idleHours"),
                    "speed": telemetry.get("speed"),
                    "latitude": telemetry.get("latitude"),
                    "longitude": telemetry.get("longitude"),
                    "engineTemperature": telemetry.get("engineTemperature"),
                    "loadPercentage": telemetry.get("loadPercentage"),
                    "batteryVoltage": telemetry.get("batteryVoltage"),
                    "vibrationLevel": telemetry.get("vibrationLevel"),
                    "rentalStatus": telemetry.get("rentalStatus"),
                    "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                },
                "geofence": geofence,
                "alertCount": len(alert_payloads),
                "alerts": alert_payloads,
            }
        )

        for a in alert_payloads:
            publish_live_event(
                {
                    "type": "ALERT_RAISED",
                    "equipmentId": str(eq_raw),
                    "equipmentType": equipment_type,
                    "siteId": str(site_id) if site_id is not None else None,
                    "severity": a.get("severity"),
                    "anomalyType": a.get("anomalyType"),
                    "message": a.get("description"),
                    "alertId": a.get("alertId"),
                }
            )

        result = {
            "success": True,
            "stored": stored,
            "storeError": store_error,
            "equipmentId": equipment_id,
            "alertCount": len(alert_payloads),
            "alerts": alert_payloads,
            "redisPublished": redis_ok,
            "geofence": geofence,
            "geofenceBatchPublished": geofence_batch_published,
        }
        if anomaly_error:
            result["anomalyError"] = anomaly_error
        return result


def _dec(v: Any) -> Decimal | None:
    if v is None:
        return None
    return Decimal(str(v))
