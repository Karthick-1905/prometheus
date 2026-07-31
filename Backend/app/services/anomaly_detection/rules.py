"""Deterministic rule-based anomaly checks (migrated from TypeScript RuleDetector)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from app.models.enums import AnomalySeverity, AnomalyType

THRESHOLDS = {
    "ENGINE_TEMP_MAX": 105,
    "VIBRATION_MAX": 15.0,
    "VIBRATION_LOAD_MIN": 90,
    "BATTERY_VOLTAGE_MIN": 11.0,
    "ENGINE_HOURS_DELTA_MAX": 1.0,
    "IDLE_HOURS_DELTA_MAX": 1.0,
    "FUEL_DELTA_MAX": 10.0,
    "GEOFENCE_DISTANCE_MAX": 0.05,
    "GEOFENCE_DISTANCE_METERS_MAX": 250.0,
}


@dataclass
class DetectedAnomaly:
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    description: str
    recommendation: str
    trigger_value: str
    threshold_value: str
    detection_source: str
    anomaly_score: Optional[float] = None


def _features(t: dict[str, Any]) -> dict[str, float]:
    """Lightweight feature deltas when previous packet is absent."""
    return {
        "engineHoursDelta": float(t.get("engineHoursDelta", 0) or 0),
        "idleHoursDelta": float(t.get("idleHoursDelta", 0) or 0),
        "fuelDelta": float(t.get("fuelDelta", 0) or 0),
        "distanceFromSiteCenter": float(t.get("distanceFromSiteCenter", 0) or 0),
    }


def detect_rules(t: dict[str, Any]) -> list[DetectedAnomaly]:
    f = _features(t)
    out: list[DetectedAnomaly] = []
    eq = t.get("equipmentId", "equipment")
    eq_type = t.get("equipmentType", "")

    if t.get("engineStatus") == "ON" and not t.get("operatorId"):
        out.append(
            DetectedAnomaly(
                AnomalyType.UNASSIGNED_OPERATOR,
                AnomalySeverity.CRITICAL,
                f"Engine is running on {eq} ({eq_type}) with no operator assigned.",
                "Verify operator assignment or shut down the engine.",
                "operatorId = NULL, engineStatus = ON",
                "operatorId must be set when engine is ON",
                "RULE",
            )
        )

    temp = float(t.get("engineTemperature") or 0)
    if temp > THRESHOLDS["ENGINE_TEMP_MAX"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.ENGINE_OVERHEAT,
                AnomalySeverity.CRITICAL,
                f"Engine temperature on {eq} is critically high at {temp}°C.",
                "Shut down immediately and inspect cooling system.",
                f"{temp}°C",
                f"> {THRESHOLDS['ENGINE_TEMP_MAX']}°C",
                "RULE",
            )
        )

    vib = float(t.get("vibrationLevel") or 0)
    load = float(t.get("loadPercentage") or 0)
    if vib > THRESHOLDS["VIBRATION_MAX"] and load >= THRESHOLDS["VIBRATION_LOAD_MIN"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.SEVERE_VIBRATION,
                AnomalySeverity.CRITICAL,
                f"Severe vibration on {eq}: {vib:.2f} mm/s at {load}% load.",
                "Reduce load and inspect mounts / hydraulics.",
                f"vibration={vib:.2f}, load={load}%",
                f"vib > {THRESHOLDS['VIBRATION_MAX']} AND load >= {THRESHOLDS['VIBRATION_LOAD_MIN']}",
                "RULE",
            )
        )

    if t.get("rentalStatus") == "Overdue":
        out.append(
            DetectedAnomaly(
                AnomalyType.EXPIRED_RENTAL,
                AnomalySeverity.WARNING,
                f"{eq} is operating beyond rental contract (Overdue).",
                "Arrange return or contract extension.",
                "rentalStatus = Overdue",
                "rentalStatus must not be Overdue",
                "RULE",
            )
        )

    if t.get("engineStatus") == "ON" and (t.get("latitude") is None or t.get("longitude") is None):
        out.append(
            DetectedAnomaly(
                AnomalyType.MISSING_GPS,
                AnomalySeverity.WARNING,
                f"GPS lost for {eq} while engine is running.",
                "Check GPS antenna / telematics unit.",
                "lat/lon NULL, engine ON",
                "GPS required when engine ON",
                "RULE",
            )
        )

    batt = float(t.get("batteryVoltage") or 99)
    if batt < THRESHOLDS["BATTERY_VOLTAGE_MIN"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.LOW_BATTERY,
                AnomalySeverity.WARNING,
                f"Battery voltage on {eq} is low at {batt}V.",
                "Inspect charging system / battery.",
                f"{batt}V",
                f"< {THRESHOLDS['BATTERY_VOLTAGE_MIN']}V",
                "RULE",
            )
        )

    if f["engineHoursDelta"] > THRESHOLDS["ENGINE_HOURS_DELTA_MAX"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.ENGINE_HOURS_TAMPER,
                AnomalySeverity.WARNING,
                f"Suspicious engine hour jump on {eq}: +{f['engineHoursDelta']:.2f} hrs.",
                "Audit telematics for tampering.",
                f"delta=+{f['engineHoursDelta']:.2f}",
                f"> {THRESHOLDS['ENGINE_HOURS_DELTA_MAX']}",
                "RULE",
            )
        )

    if f["idleHoursDelta"] > THRESHOLDS["IDLE_HOURS_DELTA_MAX"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.EXCESSIVE_IDLE,
                AnomalySeverity.INFO,
                f"{eq} idling excessively: +{f['idleHoursDelta']:.2f} hrs this step.",
                "Remind operator to shut down during breaks.",
                f"idleDelta=+{f['idleHoursDelta']:.2f}",
                f"> {THRESHOLDS['IDLE_HOURS_DELTA_MAX']}",
                "RULE",
            )
        )

    if f["fuelDelta"] > THRESHOLDS["FUEL_DELTA_MAX"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.FUEL_LEAK_THEFT,
                AnomalySeverity.CRITICAL,
                f"Abnormal fuel drop on {eq}: -{f['fuelDelta']:.1f}% in 5 minutes.",
                "Inspect tank for leak or theft.",
                f"fuelDrop=-{f['fuelDelta']:.1f}%",
                f"> {THRESHOLDS['FUEL_DELTA_MAX']}%",
                "RULE",
            )
        )

    if f["distanceFromSiteCenter"] > THRESHOLDS["GEOFENCE_DISTANCE_MAX"]:
        out.append(
            DetectedAnomaly(
                AnomalyType.GEOFENCE_VIOLATION,
                AnomalySeverity.WARNING,
                f"{eq} outside geofence (distance={f['distanceFromSiteCenter']:.4f}°).",
                "Contact site operator; verify relocation authorization.",
                f"distance={f['distanceFromSiteCenter']:.4f}",
                f"> {THRESHOLDS['GEOFENCE_DISTANCE_MAX']}",
                "RULE",
            )
        )

    distance_meters = float(t.get("distanceFromSiteCenterMeters") or 0)
    radius_meters = float(
        t.get("geofenceRadiusMeters") or THRESHOLDS["GEOFENCE_DISTANCE_METERS_MAX"]
    )
    if (
        distance_meters > radius_meters
        and not any(item.anomaly_type == AnomalyType.GEOFENCE_VIOLATION for item in out)
    ):
        out.append(
            DetectedAnomaly(
                AnomalyType.GEOFENCE_VIOLATION,
                AnomalySeverity.WARNING,
                f"{eq} is {distance_meters:.0f} m from its assigned site.",
                "Contact the site operator and verify that relocation is authorized.",
                f"distance={distance_meters:.1f}m",
                f"> {radius_meters:.1f}m",
                "RULE",
            )
        )

    return out
