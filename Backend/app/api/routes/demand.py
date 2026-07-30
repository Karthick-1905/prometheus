from fastapi import APIRouter, Query

from app.services.demand_forecasting import DemandForecastingService

router = APIRouter(prefix="/api/demand", tags=["Demand Forecasting"])


@router.get("/status")
def status():
    return DemandForecastingService.status()


@router.get("/forecast")
def forecast(
    equipmentType: str = Query("Excavator"),
    horizonDays: int = Query(7, ge=1, le=90),
):
    return DemandForecastingService.forecast(equipmentType, horizonDays)
