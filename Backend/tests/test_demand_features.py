from datetime import date, timedelta

from app.services.demand_forecasting.features import build_supervised_rows
from app.services.demand_forecasting.synthetic import WeeklyDemand


def row(week: date, requested: int, hours: float) -> WeeklyDemand:
    return WeeklyDemand(
        week, 1, 1, 1, "Road Construction", 100, "lane_km", "West",
        "Earthwork", "Motor Grader", requested, requested, requested, hours,
        4, 6 if requested else 0, 1 if requested else 0, requested * 6,
        "ACTIVE",
    )


def test_lags_are_shifted_before_target():
    monday = date(2026, 1, 5)
    rows = [
        row(monday, 1, 20),
        row(monday + timedelta(weeks=1), 3, 50),
        row(monday + timedelta(weeks=2), 5, 80),
    ]
    features, unit_targets, _, _ = build_supervised_rows(rows)
    assert unit_targets == [3.0, 5.0, 5.0]
    assert features[0]["lag_1"] == 1.0
    assert features[0]["forecast_horizon"] == 1
    assert features[1]["lag_1"] == 1.0
    assert features[1]["forecast_horizon"] == 2
    assert features[2]["lag_1"] == 3.0
    assert features[2]["rolling_mean_4"] == 2.0
    assert features[2]["forecast_horizon"] == 1
