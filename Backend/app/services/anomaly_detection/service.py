"""Hybrid anomaly pipeline: rules + Isolation Forest + persist alerts."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.domain import AnomalyAlert, RentalContract
from app.models.enums import AnomalySeverity, AnomalyType, RentalContractStatus
from app.services.anomaly_detection.predictor import predictor
from app.services.anomaly_detection.rules import DetectedAnomaly, detect_rules


def _score_to_severity(score: float) -> AnomalySeverity:
    if score >= 0.75:
        return AnomalySeverity.CRITICAL
    if score >= 0.60:
        return AnomalySeverity.WARNING
    return AnomalySeverity.INFO


def _hybrid_merge(rules: list[DetectedAnomaly], ml: list[DetectedAnomaly]) -> list[DetectedAnomaly]:
    """Prefer rule hits; keep ML if no overlapping statistical-only alert."""
    merged = list(rules)
    if ml and not rules:
        merged.extend(ml)
    elif ml:
        # Keep ML as soft signal alongside rules
        merged.extend(ml)
    return merged


class AnomalyDetectionService:
    @staticmethod
    def predict_vector(vector: dict[str, Any]) -> dict[str, Any]:
        ordered = [
            float(vector["engineHoursPerDay"]),
            float(vector["idleHoursPerDay"]),
            float(vector["rentalDays"]),
            float(vector["hasOperator"]),
            float(vector["hasSite"]),
            float(vector["idleRatio"]),
        ]
        is_anomaly, score, confidence = predictor.score(ordered)
        eq = vector.get("equipmentId")
        message = (
            f"Statistical outlier detected for {eq or 'equipment'} "
            f"(score={score:.3f}, confidence={confidence}). "
            "Usage pattern deviates from learned normal operating envelope."
            if is_anomaly
            else f"Normal operating pattern (score={score:.3f})."
        )
        return {
            "equipmentId": eq,
            "isAnomaly": is_anomaly,
            "anomalyScore": score,
            "confidence": confidence,
            "message": message,
        }

    @staticmethod
    def detect_and_record(db: Session, telemetry: dict[str, Any]) -> list[AnomalyAlert]:
        rule_findings = detect_rules(telemetry)
        if_findings: list[DetectedAnomaly] = []

        # Build ML feature vector from rental context when possible
        eq_raw = telemetry.get("equipmentId", "")
        try:
            eq_id = int("".join(ch for ch in str(eq_raw) if ch.isdigit()) or "0") or None
        except ValueError:
            eq_id = None

        rental_days = 15.0
        days_elapsed = 1.0
        if eq_id:
            stmt = (
                select(RentalContract)
                .where(
                    RentalContract.equipment_id == eq_id,
                    RentalContract.rental_status == RentalContractStatus.ACTIVE,
                )
                .order_by(RentalContract.rental_start.desc())
                .limit(1)
            )
            contract = db.execute(stmt).scalar_one_or_none()
            if contract and contract.rental_start:
                start = contract.rental_start
                if contract.expected_return:
                    rental_days = max(
                        1.0,
                        (contract.expected_return - start).total_seconds() / 86400,
                    )
                ts = telemetry.get("timestamp") or datetime.utcnow()
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
                days_elapsed = max(1.0, (ts - start).total_seconds() / 86400)

        engine_h = float(telemetry.get("engineHours") or 0)
        idle_h = float(telemetry.get("idleHours") or 0)
        eng_day = engine_h / days_elapsed
        idle_day = idle_h / days_elapsed
        total = eng_day + idle_day
        idle_ratio = (idle_day / total) if total > 0 else 0.0

        if predictor.is_loaded():
            try:
                ml = AnomalyDetectionService.predict_vector(
                    {
                        "engineHoursPerDay": eng_day,
                        "idleHoursPerDay": idle_day,
                        "rentalDays": rental_days,
                        "hasOperator": 1.0 if telemetry.get("operatorId") else 0.0,
                        "hasSite": 1.0 if telemetry.get("siteId") else 0.0,
                        "idleRatio": idle_ratio,
                        "equipmentId": str(eq_raw),
                        "equipmentType": telemetry.get("equipmentType"),
                    }
                )
                if ml["isAnomaly"]:
                    if_findings.append(
                        DetectedAnomaly(
                            anomaly_type=AnomalyType.STATISTICAL_OUTLIER,
                            severity=_score_to_severity(ml["anomalyScore"]),
                            description=(
                                f"Isolation Forest flagged {eq_raw} as outlier "
                                f"(score={ml['anomalyScore']:.3f}, conf={ml['confidence']})."
                            ),
                            recommendation="Review usage pattern and site norms.",
                            trigger_value=f"IF_score={ml['anomalyScore']:.3f}",
                            threshold_value="decision_function < tuned threshold",
                            detection_source="ISOLATION_FOREST",
                            anomaly_score=ml["anomalyScore"],
                        )
                    )
            except Exception as exc:  # noqa: BLE001
                print(f"ML predict skipped: {exc}")

        violations = _hybrid_merge(rule_findings, if_findings)
        if not violations:
            return []

        saved: list[AnomalyAlert] = []
        for v in violations:
            alert = AnomalyAlert(
                equipment_id=str(eq_raw),
                equipment_type=telemetry.get("equipmentType"),
                site_id=telemetry.get("siteId"),
                operator_id=telemetry.get("operatorId"),
                anomaly_type=v.anomaly_type,
                severity=v.severity,
                description=v.description,
                recommendation=v.recommendation,
                trigger_value=v.trigger_value,
                threshold_value=v.threshold_value,
                is_resolved=False,
            )
            db.add(alert)
            saved.append(alert)
        db.commit()
        for a in saved:
            db.refresh(a)
        return saved
