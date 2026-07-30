from app.services.demand_forecasting.service import DemandForecastingService


def test_required_customer_scenarios():
    service = DemandForecastingService()
    assert service.package_recommendations(1, "Excavator")["recommendation"]["action"] in {
        "REDUCE_CAPACITY",
        "MOVE_TO_FLEXIBLE_PACKAGE",
    }
    assert service.package_recommendations(2, "Excavator")["recommendation"]["action"] == "INCREASE_CAPACITY"
    assert service.package_recommendations(3, "Motor Grader")["recommendation"]["action"] == "CONTINUE_CURRENT_PACKAGE"
    cold = service.equipment_forecast(4, "Excavator")
    assert cold["summary"]["coldStart"] is True
    assert cold["forecast"][0]["comparableCohort"]
    assert service.package_recommendations(5, "Excavator")["recommendation"]["action"] == "SHORT_TERM_ADD_ON"


def test_dealer_transfer_never_consumes_source_buffer():
    service = DemandForecastingService()
    dealer = service.dealer_view()
    assert dealer["actions"]
    for action in dealer["actions"]:
        assert action["recommendedUnits"] > 0
        assert action["sourceSafetyBuffer"] >= 1
        assert "retains" in action["customerImpact"]


def test_all_forecast_values_are_nonnegative_and_intervals_ordered():
    service = DemandForecastingService()
    response = service.equipment_forecast(2, "Excavator")
    for point in response["forecast"]:
        assert 0 <= point["lowerUnits"] <= point["predictedUnits"] <= point["upperUnits"]
        assert point["safePlanningUnits"] >= point["predictedUnits"]
        assert point["predictedMachineHours"] >= 0
