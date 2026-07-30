import os
import csv
from datetime import datetime
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
TELEMETRY_CSV = BASE_DIR / "pipeline" / "telemetry.csv"
OUTPUT_CSV = BASE_DIR / "annomoly" / "training-data.csv"

def parse_time(ts_str):
    try:
        return datetime.strptime(ts_str.strip(), "%Y-%m-%d %H:%M")
    except ValueError:
        try:
            return datetime.strptime(ts_str.strip(), "%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            return datetime.fromisoformat(ts_str.strip().replace("Z", "+00:00"))

def aggregate_telemetry():
    print("=" * 60)
    print("CAT Fleet - Aggregating telemetry.csv to Rental Summaries")
    print("=" * 60)

    if not TELEMETRY_CSV.exists():
        print(f"Error: {TELEMETRY_CSV} not found!")
        return

    active_sessions = {}
    rental_records = []

    print("Parsing telemetry.csv...")
    row_count = 0

    with open(TELEMETRY_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_count += 1
            if row_count % 500000 == 0:
                print(f"  Processed {row_count:,} rows...")

            eq_id = row["EquipmentID"]
            site_id = row["SiteID"]
            timestamp = row["Timestamp"]
            eq_type = row["EquipmentType"]
            op_id = row["OperatorID"]
            engine_hours = float(row["EngineHours"])
            idle_hours = float(row["IdleHours"])

            # Map site ID: None represents NULL unassigned
            current_site = None if site_id == "NULL" or site_id == "" else site_id
            session = active_sessions.get(eq_id)

            if not session:
                # Start new session
                active_sessions[eq_id] = {
                    "equipmentId": eq_id,
                    "type": eq_type,
                    "siteId": current_site,
                    "checkInDate": timestamp,
                    "startEngineHours": engine_hours,
                    "startIdleHours": idle_hours,
                    "lastOperatorId": op_id if op_id != "NULL" and op_id != "" else None,
                    "lastTimestamp": timestamp,
                    "lastEngineHours": engine_hours,
                    "lastIdleHours": idle_hours
                }
            elif session["siteId"] != current_site:
                # Close old session
                check_in = parse_time(session["checkInDate"])
                check_out = parse_time(timestamp)
                delta = check_out - check_in
                rental_days = max(1, delta.days)

                total_engine = max(0.0, engine_hours - session["startEngineHours"])
                total_idle = max(0.0, idle_hours - session["startIdleHours"])

                engine_per_day = total_engine / rental_days
                idle_per_day = total_idle / rental_days
                total_per_day = engine_per_day + idle_per_day
                idle_ratio = idle_per_day / total_per_day if total_per_day > 0 else 0.0

                is_anomaly = 0
                anomaly_reason = ""

                if not session["siteId"]:
                    is_anomaly = 1
                    anomaly_reason = "Unassigned equipment (Site ID is NULL)"
                elif not session["lastOperatorId"]:
                    is_anomaly = 1
                    anomaly_reason = "Missing operator ID"
                elif idle_per_day > 9.0:
                    is_anomaly = 1
                    anomaly_reason = "Excessive idle hours"
                elif engine_per_day == 0.0:
                    is_anomaly = 1
                    anomaly_reason = "Zero engine hours (unused)"

                rental_records.append({
                    "equipmentId": eq_id,
                    "type": eq_type,
                    "engineHoursPerDay": round(engine_per_day, 2),
                    "idleHoursPerDay": round(idle_per_day, 2),
                    "rentalDays": rental_days,
                    "hasOperator": 1 if session["lastOperatorId"] else 0,
                    "hasSite": 1 if session["siteId"] else 0,
                    "idleRatio": round(idle_ratio, 4),
                    "isAnomaly": is_anomaly,
                    "anomalyReason": anomaly_reason
                })

                # Start new session
                active_sessions[eq_id] = {
                    "equipmentId": eq_id,
                    "type": eq_type,
                    "siteId": current_site,
                    "checkInDate": timestamp,
                    "startEngineHours": engine_hours,
                    "startIdleHours": idle_hours,
                    "lastOperatorId": op_id if op_id != "NULL" and op_id != "" else None,
                    "lastTimestamp": timestamp,
                    "lastEngineHours": engine_hours,
                    "lastIdleHours": idle_hours
                }
            else:
                # Update current session
                if op_id != "NULL" and op_id != "":
                    session["lastOperatorId"] = op_id
                session["lastTimestamp"] = timestamp
                session["lastEngineHours"] = engine_hours
                session["lastIdleHours"] = idle_hours

    # Close dangling active sessions at the end of the file
    for eq_id, session in active_sessions.items():
        check_in = parse_time(session["checkInDate"])
        check_out = parse_time(session["lastTimestamp"])
        delta = check_out - check_in
        rental_days = max(1, delta.days)

        total_engine = max(0.0, session["lastEngineHours"] - session["startEngineHours"])
        total_idle = max(0.0, session["lastIdleHours"] - session["startIdleHours"])

        engine_per_day = total_engine / rental_days
        idle_per_day = total_idle / rental_days
        total_per_day = engine_per_day + idle_per_day
        idle_ratio = idle_per_day / total_per_day if total_per_day > 0 else 0.0

        is_anomaly = 0
        anomaly_reason = ""
        
        if not session["siteId"]:
            is_anomaly = 1
            anomaly_reason = "Unassigned equipment (Site ID is NULL)"
        elif not session["lastOperatorId"]:
            is_anomaly = 1
            anomaly_reason = "Missing operator ID"
        elif idle_per_day > 9.0:
            is_anomaly = 1
            anomaly_reason = "Excessive idle hours"
        elif engine_per_day == 0.0:
            is_anomaly = 1
            anomaly_reason = "Zero engine hours (unused)"

        rental_records.append({
            "equipmentId": eq_id,
            "type": session["type"],
            "engineHoursPerDay": round(engine_per_day, 2),
            "idleHoursPerDay": round(idle_per_day, 2),
            "rentalDays": rental_days,
            "hasOperator": 1 if session["lastOperatorId"] else 0,
            "hasSite": 1 if session["siteId"] else 0,
            "idleRatio": round(idle_ratio, 4),
            "isAnomaly": is_anomaly,
            "anomalyReason": anomaly_reason
        })

    # Output to CSV
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "equipmentId", "type", "engineHoursPerDay", "idleHoursPerDay",
            "rentalDays", "hasOperator", "hasSite", "idleRatio", "isAnomaly", "anomalyReason"
        ])
        writer.writeheader()
        writer.writerows(rental_records)

    print(f"Completed! Wrote {len(rental_records):,} rental record summaries to {OUTPUT_CSV}")
    print(f"Total telemetry log rows parsed: {row_count:,}")

    anom_count = sum(1 for r in rental_records if r["isAnomaly"] == 1)
    print(f"  Anomalies: {anom_count:,} ({anom_count / len(rental_records):.1%})")
    print(f"  Normal   : {len(rental_records) - anom_count:,}")

if __name__ == "__main__":
    aggregate_telemetry()
