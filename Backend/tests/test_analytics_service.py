"""Unit tests for analytics formulas (no HTTP)."""
from datetime import datetime

from app.services.analytics.service import AnalyticsService


def test_usage_summary_from_seed(db_session, seed_fleet):
    data = AnalyticsService.usage_summary(
        db_session,
        company_id=seed_fleet["company_id"],
        days=7,
        now=datetime.utcnow(),
    )
    assert data["machineCount"] == 2
    assert data["totalRuntimeHours"] >= 50.0
    assert data["utilizationPct"] > 0


def test_underutilized_threshold(db_session, seed_fleet):
    low = AnalyticsService.underutilized(
        db_session,
        company_id=seed_fleet["company_id"],
        threshold=0.10,
    )
    # only crane (~4.8%) under 10%
    assert len(low) == 1
    assert low[0]["equipmentId"] == seed_fleet["equipment_ids"][1]
