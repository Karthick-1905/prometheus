"""Evaluate telemetry coordinates against project sites and publish live batches."""
from __future__ import annotations

import math
import threading
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.models.domain import EquipmentAssignment, ProjectSite, RentalContract
from app.models.enums import AssignmentStatus
from app.services.redis_bus import publish_live_event

EARTH_RADIUS_METERS = 6_371_000.0


def _number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _site_coordinates(site: ProjectSite) -> tuple[Optional[float], Optional[float], str]:
    latitude = _number(getattr(site, "latitude", None))
    longitude = _number(getattr(site, "longitude", None))
    if latitude is not None and longitude is not None:
        return latitude, longitude, "structured"

    location = (site.location or "").strip()
    if "," in location:
        raw_latitude, raw_longitude = location.split(",", 1)
        latitude = _number(raw_latitude.strip())
        longitude = _number(raw_longitude.strip())
        if latitude is not None and longitude is not None:
            return latitude, longitude, "legacy_location"
    return None, None, "unavailable"


def _haversine_meters(
    latitude: float,
    longitude: float,
    site_latitude: float,
    site_longitude: float,
) -> float:
    lat_1 = math.radians(latitude)
    lat_2 = math.radians(site_latitude)
    delta_lat = math.radians(site_latitude - latitude)
    delta_lon = math.radians(site_longitude - longitude)
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_1) * math.cos(lat_2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(value)))


class GeofencingService:
    """Resolve the authoritative site and classify one coordinate sample."""

    @staticmethod
    def evaluate(
        db: Session,
        telemetry: dict[str, Any],
        *,
        equipment_id: int,
    ) -> dict[str, Any]:
        settings = get_settings()
        radius_meters = max(1.0, float(settings.geofence_radius_meters))
        latitude = _number(telemetry.get("latitude"))
        longitude = _number(telemetry.get("longitude"))
        site = GeofencingService._resolve_site(
            db,
            equipment_id=equipment_id,
            site_id=telemetry.get("siteId"),
        )
        observed_at = telemetry.get("timestamp") or datetime.utcnow()
        if hasattr(observed_at, "isoformat"):
            observed_at = observed_at.isoformat()
        else:
            observed_at = str(observed_at)

        base = {
            "equipmentId": str(telemetry.get("equipmentId") or equipment_id),
            "internalEquipmentId": equipment_id,
            "equipmentType": telemetry.get("equipmentType"),
            "operatorId": telemetry.get("operatorId"),
            "engineStatus": telemetry.get("engineStatus"),
            "latitude": latitude,
            "longitude": longitude,
            "siteId": site.site_id if site else None,
            "siteName": site.site_name if site else None,
            "companyId": site.company_id if site else None,
            "radiusMeters": radius_meters,
            "observedAt": observed_at,
        }

        if latitude is None or longitude is None:
            return {
                **base,
                "status": "LOCATION_UNKNOWN",
                "isAtSite": False,
                "isActive": False,
                "isWorking": False,
                "distanceMeters": None,
                "siteLatitude": None,
                "siteLongitude": None,
                "siteCoordinateSource": "unavailable",
            }
        if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
            return {
                **base,
                "status": "LOCATION_INVALID",
                "isAtSite": False,
                "isActive": False,
                "isWorking": False,
                "distanceMeters": None,
                "siteLatitude": None,
                "siteLongitude": None,
                "siteCoordinateSource": "unavailable",
            }
        if site is None:
            return {
                **base,
                "status": "SITE_UNKNOWN",
                "isAtSite": False,
                "isActive": False,
                "isWorking": False,
                "distanceMeters": None,
                "siteLatitude": None,
                "siteLongitude": None,
                "siteCoordinateSource": "unavailable",
            }

        site_latitude, site_longitude, coordinate_source = _site_coordinates(site)
        if site_latitude is None or site_longitude is None:
            return {
                **base,
                "status": "SITE_COORDINATES_MISSING",
                "isAtSite": False,
                "isActive": False,
                "isWorking": False,
                "distanceMeters": None,
                "siteLatitude": site_latitude,
                "siteLongitude": site_longitude,
                "siteCoordinateSource": coordinate_source,
            }

        distance_meters = _haversine_meters(
            latitude,
            longitude,
            site_latitude,
            site_longitude,
        )
        is_at_site = distance_meters <= radius_meters
        engine_on = str(telemetry.get("engineStatus") or "").strip().upper() == "ON"
        status = (
            "ACTIVE_WORKING"
            if is_at_site and engine_on
            else "AT_SITE_IDLE"
            if is_at_site
            else "OUTSIDE_SITE"
        )
        return {
            **base,
            "status": status,
            "isAtSite": is_at_site,
            "isActive": is_at_site,
            "isWorking": is_at_site and engine_on,
            "distanceMeters": round(distance_meters, 1),
            "siteLatitude": site_latitude,
            "siteLongitude": site_longitude,
            "siteCoordinateSource": coordinate_source,
        }

    @staticmethod
    def _resolve_site(
        db: Session,
        *,
        equipment_id: int,
        site_id: Any,
    ) -> Optional[ProjectSite]:
        raw_site_id = str(site_id or "")
        digits = "".join(character for character in raw_site_id if character.isdigit())
        if digits:
            site = db.get(ProjectSite, int(digits))
            if site is not None:
                return site

        statement = (
            select(EquipmentAssignment)
            .options(joinedload(EquipmentAssignment.site))
            .join(
                RentalContract,
                EquipmentAssignment.contract_id == RentalContract.contract_id,
            )
            .where(
                RentalContract.equipment_id == equipment_id,
                EquipmentAssignment.status == AssignmentStatus.ACTIVE,
            )
            .order_by(EquipmentAssignment.checkout_time.desc())
            .limit(1)
        )
        assignment = db.execute(statement).unique().scalar_one_or_none()
        return assignment.site if assignment else None


class GeofenceBatchService:
    """Batch evaluated coordinates by company and publish them to the live bus."""

    def __init__(
        self,
        *,
        batch_size: Optional[int] = None,
        batch_window_seconds: Optional[float] = None,
        publisher: Callable[[dict[str, Any]], bool] = publish_live_event,
    ) -> None:
        settings = get_settings()
        self.batch_size = max(
            1,
            int(batch_size or settings.geofence_batch_size),
        )
        self.batch_window_seconds = max(
            0.05,
            float(batch_window_seconds or settings.geofence_batch_window_ms / 1000),
        )
        self.publisher = publisher
        self._lock = threading.Lock()
        self._batches: dict[str, list[dict[str, Any]]] = defaultdict(list)
        self._started_at: dict[str, datetime] = {}
        self._timers: dict[str, threading.Timer] = {}

    def add(self, coordinate: dict[str, Any]) -> bool:
        if coordinate.get("latitude") is None or coordinate.get("longitude") is None:
            return False
        key = str(coordinate.get("companyId") or "unscoped")
        batch: Optional[dict[str, Any]] = None
        with self._lock:
            if not self._batches[key]:
                self._started_at[key] = datetime.utcnow()
                timer = threading.Timer(
                    self.batch_window_seconds,
                    self._flush_timer,
                    args=(key,),
                )
                timer.daemon = True
                self._timers[key] = timer
                timer.start()
            self._batches[key].append(dict(coordinate))
            if len(self._batches[key]) >= self.batch_size:
                batch = self._take_locked(key)
        return self._publish(batch) if batch else False

    def flush(self, company_id: Any = None) -> bool:
        key = str(company_id or "unscoped")
        with self._lock:
            batch = self._take_locked(key)
        return self._publish(batch)

    def flush_all(self) -> int:
        with self._lock:
            keys = list(self._batches)
            batches = [self._take_locked(key) for key in keys]
        return sum(1 for batch in batches if self._publish(batch))

    def _flush_timer(self, key: str) -> None:
        with self._lock:
            batch = self._take_locked(key)
        self._publish(batch)

    def _take_locked(self, key: str) -> Optional[dict[str, Any]]:
        coordinates = self._batches.pop(key, [])
        started_at = self._started_at.pop(key, None)
        timer = self._timers.pop(key, None)
        if timer and timer is not threading.current_thread():
            timer.cancel()
        if not coordinates:
            return None
        statuses: dict[str, int] = defaultdict(int)
        for coordinate in coordinates:
            statuses[str(coordinate.get("status") or "UNKNOWN")] += 1
        return {
            "type": "GEOFENCE_BATCH",
            "batchId": f"geo-{uuid.uuid4().hex[:12]}",
            "companyId": coordinates[0].get("companyId"),
            "windowStartedAt": (
                started_at.isoformat() if started_at else datetime.utcnow().isoformat()
            ),
            "emittedAt": datetime.utcnow().isoformat(),
            "count": len(coordinates),
            "summary": dict(statuses),
            "coordinates": coordinates,
        }

    def _publish(self, batch: Optional[dict[str, Any]]) -> bool:
        return bool(batch and self.publisher(batch))


geofence_batch_service = GeofenceBatchService()
