from pathlib import Path

from app.services.demand_forecasting.modeling import (
    ARTIFACT_VERSION,
    load_demand_bundle,
)


def test_saved_artifact_contains_independent_verification_evidence():
    artifact_dir = Path(__file__).resolve().parents[1] / "artifacts" / "demand_forecasting"
    bundle = load_demand_bundle(artifact_dir)
    assert bundle is not None
    assert bundle.artifact_version == ARTIFACT_VERSION
    assert bundle.unit_serving_method
    assert bundle.hour_serving_method

    metrics = bundle.metrics
    assert metrics["verificationStatus"] == "SYNTHETIC_ENGINEERING_EVIDENCE_ONLY"
    assert metrics["validation"]["directHorizons"] == [1, 2, 3, 4]
    assert metrics["validation"]["holdoutRows"] > 0
    for target in ("units", "machineHours"):
        report = metrics[target]
        assert len(report["rollingOrigins"]) == 3
        assert set(report["byHorizon"]) == {"week1", "week2", "week3", "week4"}
        assert report["byEquipmentType"]
        assert report["byProjectPhase"]
        assert report["byRegion"]
        assert 0 <= report["interval"]["holdoutCoverage"] <= 1
    assert metrics["coldStart"]["heldOutProjectIds"]
    assert metrics["coldStart"]["rows"] > 0
