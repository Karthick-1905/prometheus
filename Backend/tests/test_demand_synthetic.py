from app.services.demand_forecasting.synthetic import generate_demo_dataset


def test_synthetic_generation_is_deterministic_and_large_enough():
    first = generate_demo_dataset(seed=20260730)
    second = generate_demo_dataset(seed=20260730)
    assert first.manifest()["sha256"] == second.manifest()["sha256"]
    assert first.manifest()["weeklyRowCount"] >= 1000
    assert len(first.projects) == 28


def test_synthetic_weekly_invariants():
    dataset = generate_demo_dataset(seed=20260730)
    for row in dataset.weekly_demand:
        assert row.requested_units >= 0
        assert 0 <= row.fulfilled_units <= row.requested_units
        assert 0 <= row.rented_units <= row.fulfilled_units
        assert row.engine_hours >= 0
        assert row.idle_hours >= 0
        if row.rented_days == 0:
            assert row.engine_hours == 0
