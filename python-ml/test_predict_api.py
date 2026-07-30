"""
test_predict_api.py
-------------------
Hits a running ML server (default http://localhost:8000) with normal + anomaly
payloads and prints results.

  python test_predict_api.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as res:
        return json.loads(res.read().decode("utf-8"))


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as res:
        return json.loads(res.read().decode("utf-8"))


def main() -> None:
    print(f"Testing ML API at {BASE}")
    try:
        health = get("/health")
    except Exception as e:
        print(f"FAIL: cannot reach server — {e}")
        print("Start it with: cd python-ml && python main.py")
        sys.exit(1)

    print("Health:", json.dumps(health, indent=2))
    if not health.get("model_loaded"):
        print("Model not loaded — POST /train first or run npm run ml:train")
        sys.exit(1)

    status = get("/model/status")
    print("Model status:", json.dumps(status, indent=2))

    cases = [
        (
            "normal",
            {
                "fuelLevel": 70,
                "engineHours": 1500,
                "idleHours": 300,
                "speed": 10,
                "engineTemperature": 85,
                "hydraulicPressure": 160,
                "batteryVoltage": 13.5,
                "loadPercentage": 50,
                "vibrationLevel": 3.0,
                "fuelDelta": 0.3,
                "engineHoursDelta": 0.08,
                "idleHoursDelta": 0.02,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.003,
                "equipmentId": "CAT-EX-1001",
                "equipmentType": "Excavator",
            },
        ),
        (
            "overheat",
            {
                "fuelLevel": 55,
                "engineHours": 1600,
                "idleHours": 320,
                "speed": 4,
                "engineTemperature": 114,
                "hydraulicPressure": 230,
                "batteryVoltage": 13.0,
                "loadPercentage": 96,
                "vibrationLevel": 14.0,
                "fuelDelta": 5.5,
                "engineHoursDelta": 0.1,
                "idleHoursDelta": 0.01,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.004,
                "equipmentId": "CAT-EX-1002",
                "equipmentType": "Excavator",
            },
        ),
        (
            "fuel_leak",
            {
                "fuelLevel": 15,
                "engineHours": 1400,
                "idleHours": 280,
                "speed": 0,
                "engineTemperature": 78,
                "hydraulicPressure": 140,
                "batteryVoltage": 13.4,
                "loadPercentage": 5,
                "vibrationLevel": 1.0,
                "fuelDelta": 19.0,
                "engineHoursDelta": 0.01,
                "idleHoursDelta": 0.8,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.002,
                "equipmentId": "CAT-DT-1003",
                "equipmentType": "Dump Truck",
            },
        ),
        (
            "severe_vib",
            {
                "fuelLevel": 50,
                "engineHours": 900,
                "idleHours": 180,
                "speed": 2,
                "engineTemperature": 102,
                "hydraulicPressure": 220,
                "batteryVoltage": 13.1,
                "loadPercentage": 98,
                "vibrationLevel": 24.0,
                "fuelDelta": 1.2,
                "engineHoursDelta": 0.07,
                "idleHoursDelta": 0.01,
                "engineOn": 1,
                "distanceFromSiteCenter": 0.005,
                "equipmentId": "CAT-BD-1004",
                "equipmentType": "Bulldozer",
            },
        ),
    ]

    print("\n── /predict cases ──")
    for name, body in cases:
        try:
            out = post("/predict", body)
            print(
                f"  {name:12s} → isAnomaly={out['isAnomaly']}  "
                f"score={out['anomalyScore']:.3f}  conf={out['confidence']}"
            )
            print(f"               {out['message']}")
        except urllib.error.HTTPError as e:
            print(f"  {name:12s} → HTTP {e.code}: {e.read().decode()}")

    print("\nOK — API test complete")


if __name__ == "__main__":
    main()
