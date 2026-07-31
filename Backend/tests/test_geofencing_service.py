import threading

from app.models.domain import ProjectSite
from app.services.anomaly_detection.rules import detect_rules
from app.services.geofencing.service import GeofenceBatchService, GeofencingService


def test_geofence_marks_machine_working_at_assigned_site(db_session, seed_fleet):
    site = db_session.get(ProjectSite, seed_fleet["site_id"])
    site.latitude = 37.7749
    site.longitude = -122.4194
    db_session.commit()

    result = GeofencingService.evaluate(
        db_session,
        {
            "equipmentId": str(seed_fleet["equipment_ids"][0]),
            "equipmentType": "Excavator",
            "engineStatus": "ON",
            "latitude": 37.77491,
            "longitude": -122.41941,
        },
        equipment_id=seed_fleet["equipment_ids"][0],
    )

    assert result["siteId"] == seed_fleet["site_id"]
    assert result["status"] == "ACTIVE_WORKING"
    assert result["isAtSite"] is True
    assert result["isWorking"] is True
    assert result["distanceMeters"] < 5


def test_geofence_outside_site_feeds_meter_based_anomaly_rule(db_session, seed_fleet):
    site = db_session.get(ProjectSite, seed_fleet["site_id"])
    site.latitude = 37.7749
    site.longitude = -122.4194
    db_session.commit()

    result = GeofencingService.evaluate(
        db_session,
        {
            "equipmentId": str(seed_fleet["equipment_ids"][0]),
            "engineStatus": "ON",
            "latitude": 37.7849,
            "longitude": -122.4194,
        },
        equipment_id=seed_fleet["equipment_ids"][0],
    )
    findings = detect_rules(
        {
            "equipmentId": result["equipmentId"],
            "distanceFromSiteCenterMeters": result["distanceMeters"],
            "geofenceRadiusMeters": result["radiusMeters"],
        }
    )

    assert result["status"] == "OUTSIDE_SITE"
    assert result["distanceMeters"] > result["radiusMeters"]
    assert any(item.anomaly_type.value == "GEOFENCE_VIOLATION" for item in findings)


def test_geofence_uses_legacy_location_coordinates(db_session, seed_fleet):
    site = db_session.get(ProjectSite, seed_fleet["site_id"])
    site.latitude = None
    site.longitude = None
    site.location = "37.7749,-122.4194"
    db_session.commit()

    result = GeofencingService.evaluate(
        db_session,
        {
            "equipmentId": str(seed_fleet["equipment_ids"][0]),
            "siteId": seed_fleet["site_id"],
            "engineStatus": "OFF",
            "latitude": 37.7749,
            "longitude": -122.4194,
        },
        equipment_id=seed_fleet["equipment_ids"][0],
    )

    assert result["status"] == "AT_SITE_IDLE"
    assert result["siteCoordinateSource"] == "legacy_location"


def test_coordinate_batch_publishes_at_size_limit():
    published = []
    batcher = GeofenceBatchService(
        batch_size=2,
        batch_window_seconds=60,
        publisher=lambda event: published.append(event) is None or True,
    )
    coordinate = {
        "equipmentId": "1",
        "companyId": 7,
        "latitude": 37.1,
        "longitude": -122.1,
        "status": "ACTIVE_WORKING",
    }

    assert batcher.add(coordinate) is False
    assert batcher.add({**coordinate, "equipmentId": "2"}) is True

    assert len(published) == 1
    assert published[0]["type"] == "GEOFENCE_BATCH"
    assert published[0]["companyId"] == 7
    assert published[0]["count"] == 2
    assert published[0]["summary"] == {"ACTIVE_WORKING": 2}
    assert [row["equipmentId"] for row in published[0]["coordinates"]] == ["1", "2"]


def test_coordinate_batch_publishes_when_time_window_expires():
    published = []
    delivered = threading.Event()

    def publisher(event):
        published.append(event)
        delivered.set()
        return True

    batcher = GeofenceBatchService(
        batch_size=20,
        batch_window_seconds=0.05,
        publisher=publisher,
    )
    batcher.add(
        {
            "equipmentId": "1",
            "companyId": 9,
            "latitude": 37.1,
            "longitude": -122.1,
            "status": "AT_SITE_IDLE",
        }
    )

    assert delivered.wait(timeout=0.5)
    assert published[0]["count"] == 1
    assert published[0]["summary"] == {"AT_SITE_IDLE": 1}


def test_simulation_ingestion_returns_geofence_result(
    client,
    db_session,
    site_headers,
    seed_fleet,
):
    site = db_session.get(ProjectSite, seed_fleet["site_id"])
    site.latitude = 37.7749
    site.longitude = -122.4194
    db_session.commit()

    response = client.post(
        "/api/simulate",
        headers=site_headers,
        json={
            "equipmentId": str(seed_fleet["equipment_ids"][0]),
            "equipmentType": "Excavator",
            "siteId": str(seed_fleet["site_id"]),
            "operatorId": "OP001",
            "engineStatus": "ON",
            "latitude": 37.7749,
            "longitude": -122.4194,
        },
    )

    assert response.status_code == 200
    geofence = response.json()["result"]["geofence"]
    assert geofence["status"] == "ACTIVE_WORKING"
    assert geofence["siteId"] == seed_fleet["site_id"]


def test_simulation_rejects_invalid_coordinates(client, site_headers, seed_fleet):
    response = client.post(
        "/api/simulate",
        headers=site_headers,
        json={
            "equipmentId": str(seed_fleet["equipment_ids"][0]),
            "latitude": 120,
            "longitude": -122.4194,
        },
    )

    assert response.status_code == 422
