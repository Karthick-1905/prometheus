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
                "engineHoursPerDay": 6.5,
                "idleHoursPerDay": 1.2,
                "rentalDays": 15.0,
                "hasOperator": 1.0,
                "hasSite": 1.0,
                "idleRatio": 0.1558,
                "equipmentId": "CAT-EX-1001",
                "equipmentType": "Excavator",
            },
        ),
        (
            "excessive_idle",
            {
                "engineHoursPerDay": 1.5,
                "idleHoursPerDay": 10.0,
                "rentalDays": 15.0,
                "hasOperator": 1.0,
                "hasSite": 1.0,
                "idleRatio": 0.8696,
                "equipmentId": "CAT-EX-1002",
                "equipmentType": "Excavator",
            },
        ),
        (
            "unassigned_site",
            {
                "engineHoursPerDay": 0.0,
                "idleHoursPerDay": 11.0,
                "rentalDays": 20.0,
                "hasOperator": 0.0,
                "hasSite": 0.0,
                "idleRatio": 1.0,
                "equipmentId": "CAT-DT-1003",
                "equipmentType": "Dump Truck",
            },
        ),
        (
            "unassigned_operator",
            {
                "engineHoursPerDay": 4.0,
                "idleHoursPerDay": 1.0,
                "rentalDays": 10.0,
                "hasOperator": 0.0,
                "hasSite": 1.0,
                "idleRatio": 0.2,
                "equipmentId": "CAT-BD-1004",
                "equipmentType": "Bulldozer",
            },
        ),
    ]

    print("\n-- /predict cases --")
    for name, body in cases:
        try:
            out = post("/predict", body)
            print(
                f"  {name:12s} -> isAnomaly={out['isAnomaly']}  "
                f"score={out['anomalyScore']:.3f}  conf={out['confidence']}"
            )
            print(f"               {out['message']}")
        except urllib.error.HTTPError as e:
            print(f"  {name:12s} -> HTTP {e.code}: {e.read().decode()}")

    print("\nOK - API test complete")


if __name__ == "__main__":
    main()
