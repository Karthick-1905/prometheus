#!/usr/bin/env python3
"""
seed_demo_data.py
-----------------
Wipe domain tables and seed realistic demo data for the CAT Smart Rental frontend.

Usage (from Backend/):
    .venv/bin/python scripts/seed_demo_data.py
    make seed

Requires DATABASE_URL in Backend/.env (Neon / Postgres).
Does NOT touch demand-forecasting tables if present.
"""
from __future__ import annotations

import os
import random
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

# Backend root on path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal, engine
from app.models.domain import (
    AnomalyAlert,
    Company,
    Dealer,
    Equipment,
    EquipmentAssignment,
    EquipmentTelemetry,
    ProjectSite,
    RentalContract,
    UsageLog,
    User,
)
from app.models.enums import (
    AnomalySeverity,
    AnomalyType,
    AssignmentStatus,
    EquipmentStatus,
    ProjectSiteStatus,
    RentalContractStatus,
    UserRole,
)

# ── Config ─────────────────────────────────────────────────────────
SEED = int(os.getenv("SEED_DEMO_SEED", "42"))
N_EQUIPMENT = int(os.getenv("SEED_N_EQUIPMENT", "55"))
N_TELEMETRY_PER_EQ = int(os.getenv("SEED_N_TELEMETRY", "8"))
N_USAGE_PER_ASSIGNMENT = int(os.getenv("SEED_N_USAGE", "6"))
N_ALERTS = int(os.getenv("SEED_N_ALERTS", "35"))

rng = random.Random(SEED)

EQUIPMENT_TYPES = [
    "Excavator",
    "Bulldozer",
    "Crane",
    "Wheel Loader",
    "Motor Grader",
    "Backhoe Loader",
    "Dump Truck",
    "Compactor",
    "Skid Steer Loader",
    "Asphalt Paver",
]

SITE_DEFS = [
    ("North Pit", "37.7749,-122.4194"),
    ("South Yard", "37.3382,-121.8863"),
    ("East Corridor", "37.8715,-122.2730"),
    ("West Ridge", "37.5485,-121.9886"),
    ("Central Depot", "37.6879,-122.4702"),
    ("Harbor Staging", "37.7955,-122.3937"),
    ("Quarry Alpha", "37.4419,-122.1430"),
    ("Highway Spur 101", "37.5629,-122.3255"),
]

DEALER_DEFS = [
    ("Metro CAT Rentals", "dealer@metrocats.com", "415-555-0101", "100 Market St, SF"),
    ("Bay Area Heavy", "sales@bayheavy.com", "510-555-0142", "2200 Industrial Ave, Oakland"),
    ("Pacific Equipment Co", "info@pacific-eq.com", "408-555-0199", "88 Silicon Way, San Jose"),
]

COMPANY_DEFS = [
    ("North Build Co", "fleet@northbuild.com", "415-555-1000"),
    ("Summit Civil Works", "ops@summitcivil.com", "510-555-2000"),
    ("Harbor Infrastructure LLC", "fleet@harborinfra.com", "408-555-3000"),
]

# Domain tables only (FK-safe wipe order: children → parents)
WIPE_TABLES = [
    "UsageLog",
    "EquipmentTelemetry",
    "AnomalyAlert",
    "EquipmentAssignment",
    "RentalContract",
    "Equipment",
    "ProjectSite",
    "User",
    "Company",
    "Dealer",
]


def wipe(db: Session) -> None:
    """Remove all rows from domain tables (preserve schema)."""
    print("Wiping domain table data…")
    # Prefer TRUNCATE CASCADE on Postgres
    dialect = engine.dialect.name
    if dialect.startswith("postgres"):
        tables = ", ".join(f'"{t}"' for t in WIPE_TABLES)
        db.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
        db.commit()
    else:
        for t in WIPE_TABLES:
            db.execute(text(f'DELETE FROM "{t}"'))
        db.commit()
    print(f"  Cleared: {', '.join(WIPE_TABLES)}")


def _dec(v: float, places: int = 2) -> Decimal:
    return Decimal(str(round(v, places)))


def seed(db: Session) -> dict:
    now = datetime.utcnow()

    def ts_fields() -> dict:
        """Neon Prisma schema requires NOT NULL updated_at without always having DB default."""
        return {"created_at": now, "updated_at": now}

    # ── Dealers ────────────────────────────────────────────────────
    dealers: list[Dealer] = []
    for name, email, phone, address in DEALER_DEFS:
        d = Dealer(
            dealer_name=name,
            email=email,
            phone=phone,
            address=address,
            **ts_fields(),
        )
        dealers.append(d)
    db.add_all(dealers)
    db.flush()

    # ── Companies + users + sites ──────────────────────────────────
    companies: list[Company] = []
    users_by_company: dict[int, list[User]] = {}
    sites_by_company: dict[int, list[ProjectSite]] = {}

    for i, (cname, cemail, cphone) in enumerate(COMPANY_DEFS):
        c = Company(
            company_name=cname,
            email=cemail,
            phone=cphone,
            address=f"{100 + i * 10} Builder Rd, Suite {i + 1}",
            **ts_fields(),
        )
        companies.append(c)
    db.add_all(companies)
    db.flush()

    for ci, company in enumerate(companies):
        fm = User(
            company_id=company.company_id,
            name=f"{company.company_name} Fleet Manager",
            email=f"fleet.mgr{ci + 1}@demo.cat",
            password="demo",
            role=UserRole.FLEET_MANAGER,
            **ts_fields(),
        )
        se = User(
            company_id=company.company_id,
            name=f"{company.company_name} Site Engineer",
            email=f"site.eng{ci + 1}@demo.cat",
            password="demo",
            role=UserRole.SITE_ENGINEER,
            **ts_fields(),
        )
        db.add_all([fm, se])
        db.flush()
        users_by_company[company.company_id] = [fm, se]

        # 2–3 sites per company from SITE_DEFS
        company_sites: list[ProjectSite] = []
        for j in range(3):
            sdef = SITE_DEFS[(ci * 3 + j) % len(SITE_DEFS)]
            st = ProjectSite(
                company_id=company.company_id,
                site_name=f"{sdef[0]} ({company.company_name.split()[0]})",
                location=sdef[1],
                status=ProjectSiteStatus.ACTIVE if j < 2 else ProjectSiteStatus.ON_HOLD,
                **ts_fields(),
            )
            company_sites.append(st)
        db.add_all(company_sites)
        db.flush()
        sites_by_company[company.company_id] = company_sites

    # ── Equipment (50+) ────────────────────────────────────────────
    equipments: list[Equipment] = []
    for i in range(N_EQUIPMENT):
        dealer = dealers[i % len(dealers)]
        etype = EQUIPMENT_TYPES[i % len(EQUIPMENT_TYPES)]
        # ~70% rented, 20% available, 10% maintenance
        roll = rng.random()
        if roll < 0.70:
            status = EquipmentStatus.RENTED
        elif roll < 0.90:
            status = EquipmentStatus.AVAILABLE
        else:
            status = EquipmentStatus.MAINTENANCE

        eq = Equipment(
            dealer_id=dealer.dealer_id,
            equipment_name=f"CAT {etype[:3].upper()}-{1000 + i}",
            equipment_type=etype,
            model=f"Model-{etype[:4]}-{rng.randint(100, 999)}",
            serial_number=f"SN-{SEED}-{i:04d}",
            qr_code=f"QR-EQ-{i + 1:04d}",
            rfid_tag=f"RFID-{i + 1:04d}",
            status=status,
            daily_rental_cost=_dec(rng.uniform(250, 1800), 2),
            **ts_fields(),
        )
        equipments.append(eq)
    db.add_all(equipments)
    db.flush()

    # ── Rental contracts for RENTED units ──────────────────────────
    rented = [e for e in equipments if e.status == EquipmentStatus.RENTED]
    contracts: list[RentalContract] = []
    for i, eq in enumerate(rented):
        company = companies[i % len(companies)]
        start = now - timedelta(days=rng.randint(5, 45))
        duration = rng.randint(10, 40)
        expected = start + timedelta(days=duration)
        # overdue when expected return is past; otherwise active
        if expected < now:
            status = RentalContractStatus.OVERDUE
        else:
            status = RentalContractStatus.ACTIVE

        # a few completed for history
        if i % 11 == 0:
            status = RentalContractStatus.COMPLETED
            actual = expected - timedelta(days=1)
            if eq.status == EquipmentStatus.RENTED:
                eq.status = EquipmentStatus.AVAILABLE
        else:
            actual = None

        c = RentalContract(
            dealer_id=eq.dealer_id,
            company_id=company.company_id,
            equipment_id=eq.equipment_id,
            rental_start=start,
            expected_return=expected,
            actual_return=actual,
            rental_status=status,
            **ts_fields(),
        )
        contracts.append(c)
    db.add_all(contracts)
    db.flush()

    # ── Assignments for active/overdue contracts ───────────────────
    active_contracts = [
        c
        for c in contracts
        if c.rental_status in (RentalContractStatus.ACTIVE, RentalContractStatus.OVERDUE)
    ]
    assignments: list[EquipmentAssignment] = []
    for i, c in enumerate(active_contracts):
        sites = sites_by_company[c.company_id]
        users = users_by_company[c.company_id]
        # ~85% assigned to a site
        if rng.random() < 0.85:
            # skip ON_HOLD sites for most
            active_sites = [s for s in sites if s.status == ProjectSiteStatus.ACTIVE] or sites
            site = active_sites[i % len(active_sites)]
            actor = users[0]
            checkout = now - timedelta(hours=rng.randint(1, 72))
            a = EquipmentAssignment(
                contract_id=c.contract_id,
                site_id=site.site_id,
                assigned_by=actor.user_id,
                checked_out_by=actor.user_id,
                checkout_time=checkout,
                checkin_time=None,
                status=AssignmentStatus.ACTIVE,
                **ts_fields(),
            )
            assignments.append(a)
        # else unassigned — shows up in fleet/unassigned
    db.add_all(assignments)
    db.flush()

    # ── Usage logs ─────────────────────────────────────────────────
    usage_logs: list[UsageLog] = []
    for a in assignments:
        for k in range(N_USAGE_PER_ASSIGNMENT):
            usage_logs.append(
                UsageLog(
                    assignment_id=a.assignment_id,
                    runtime_hours=_dec(rng.uniform(2, 10), 2),
                    idle_hours=_dec(rng.uniform(0.5, 6), 2),
                    fuel_consumed=_dec(rng.uniform(15, 120), 2),
                    latitude=_dec(37.3 + rng.random() * 0.6, 6),
                    longitude=_dec(-122.5 + rng.random() * 0.4, 6),
                    recorded_at=now - timedelta(hours=rng.randint(1, 24 * 6)),
                )
            )
    db.add_all(usage_logs)
    db.flush()

    # ── Telemetry (live fleet map / status) ────────────────────────
    # Map site → lat/lon for equipment on site
    site_coords: dict[int, tuple[float, float]] = {}
    for sites in sites_by_company.values():
        for s in sites:
            if s.location and "," in s.location:
                lat_s, lon_s = s.location.split(",", 1)
                site_coords[s.site_id] = (float(lat_s), float(lon_s))

    contract_by_eq = {c.equipment_id: c for c in contracts}
    assignment_by_contract = {a.contract_id: a for a in assignments}

    telemetries: list[EquipmentTelemetry] = []
    tel_id = 1
    for eq in equipments:
        c = contract_by_eq.get(eq.equipment_id)
        site_id = None
        if c and c.contract_id in assignment_by_contract:
            site_id = assignment_by_contract[c.contract_id].site_id
        base_lat, base_lon = site_coords.get(site_id, (37.7749, -122.4194)) if site_id else (
            37.5 + rng.random() * 0.4,
            -122.4 + rng.random() * 0.3,
        )

        engine_hours = rng.uniform(400, 4500)
        idle_hours = rng.uniform(50, 800)
        fuel = rng.uniform(25, 95)

        for t in range(N_TELEMETRY_PER_EQ):
            # spread over last ~2 days
            ts = now - timedelta(minutes=(N_TELEMETRY_PER_EQ - t) * 30 + rng.randint(0, 10))
            engine_hours += rng.uniform(0.05, 0.4)
            idle_hours += rng.uniform(0.02, 0.25)
            fuel = max(5.0, fuel - rng.uniform(0.2, 1.5))

            # mix of engine states
            if eq.status == EquipmentStatus.AVAILABLE:
                eng = "OFF"
                load = 0.0
                speed = 0.0
                temp = rng.uniform(30, 50)
            elif eq.status == EquipmentStatus.MAINTENANCE:
                eng = "OFF"
                load = 0.0
                speed = 0.0
                temp = rng.uniform(25, 45)
            else:
                # rented: 70% ON
                eng = "ON" if rng.random() < 0.72 else "OFF"
                if eng == "ON":
                    load = rng.uniform(20, 95)
                    speed = rng.uniform(0, 18)
                    temp = rng.uniform(75, 108)  # some overheat
                else:
                    load = 0.0
                    speed = 0.0
                    temp = rng.uniform(40, 70)

            rental_status = "Working"
            if c:
                if c.rental_status == RentalContractStatus.OVERDUE:
                    rental_status = "Overdue"
                elif c.rental_status == RentalContractStatus.COMPLETED:
                    rental_status = "Returned"
            if eq.status == EquipmentStatus.AVAILABLE:
                rental_status = "Available"

            telemetries.append(
                EquipmentTelemetry(
                    telemetry_id=tel_id,
                    equipment_id=eq.equipment_id,
                    timestamp=ts,
                    engine_status=eng,
                    fuel_level=_dec(fuel, 2),
                    engine_hours=_dec(engine_hours, 2),
                    idle_hours=_dec(idle_hours, 2),
                    speed=_dec(speed, 2),
                    latitude=_dec(base_lat + rng.uniform(-0.01, 0.01), 6),
                    longitude=_dec(base_lon + rng.uniform(-0.01, 0.01), 6),
                    engine_temperature=_dec(temp, 2),
                    hydraulic_pressure=_dec(rng.uniform(120, 220), 2),
                    battery_voltage=_dec(rng.uniform(10.5, 14.2), 2),
                    load_percentage=_dec(load, 2),
                    vibration_level=_dec(rng.uniform(0.5, 18), 2),
                    rental_status=rental_status,
                )
            )
            tel_id += 1
    db.add_all(telemetries)
    db.flush()

    # ── Anomaly alerts ─────────────────────────────────────────────
    anomaly_types = list(AnomalyType)
    severities = [AnomalySeverity.CRITICAL, AnomalySeverity.WARNING, AnomalySeverity.INFO]
    alerts: list[AnomalyAlert] = []
    for i in range(N_ALERTS):
        eq = equipments[i % len(equipments)]
        c = contract_by_eq.get(eq.equipment_id)
        site_id = None
        if c and c.contract_id in assignment_by_contract:
            site_id = assignment_by_contract[c.contract_id].site_id
        atype = anomaly_types[i % len(anomaly_types)]
        sev = severities[i % len(severities)]
        resolved = rng.random() < 0.25
        alerts.append(
            AnomalyAlert(
                equipment_id=str(eq.equipment_id),
                equipment_type=eq.equipment_type,
                site_id=str(site_id) if site_id else None,
                operator_id=f"OP-{100 + (i % 20)}" if rng.random() < 0.6 else None,
                anomaly_type=atype,
                severity=sev,
                description=(
                    f"{atype.value.replace('_', ' ').title()} detected on "
                    f"{eq.equipment_name} ({eq.equipment_type})."
                ),
                recommendation="Review site operations and inspect equipment.",
                trigger_value=f"sample={rng.randint(1, 999)}",
                threshold_value="rule/ML threshold",
                is_resolved=resolved,
                resolved_at=now - timedelta(hours=rng.randint(1, 48)) if resolved else None,
                detected_at=now - timedelta(hours=rng.randint(1, 120)),
            )
        )
    db.add_all(alerts)
    db.commit()

    return {
        "dealers": len(dealers),
        "companies": len(companies),
        "users": sum(len(v) for v in users_by_company.values()),
        "sites": sum(len(v) for v in sites_by_company.values()),
        "equipment": len(equipments),
        "contracts": len(contracts),
        "assignments": len(assignments),
        "usage_logs": len(usage_logs),
        "telemetry": len(telemetries),
        "alerts": len(alerts),
    }


def main() -> int:
    print("=" * 60)
    print(" CAT Smart Rental — Demo DB Seed")
    print("=" * 60)
    print(f"Target: {engine.url.render_as_string(hide_password=True)}")
    print(f"Seed RNG={SEED}  equipment={N_EQUIPMENT}")
    print()

    db = SessionLocal()
    try:
        wipe(db)
        print("Seeding demo data…")
        counts = seed(db)
        print()
        print("✓ Seed complete:")
        for k, v in counts.items():
            print(f"  {k:14} {v}")
        total_rows = sum(counts.values())
        print(f"  {'TOTAL':14} {total_rows}")
        print()
        print("Demo logins (header auth):")
        print("  X-User-Role: FLEET_MANAGER  X-Company-Id: 1")
        print("  X-User-Role: DEALER         X-Dealer-Id: 1")
        print("  X-User-Role: SITE_MANAGER   X-Company-Id: 1  X-Site-Id: 1")
        print()
        print("Or JWT: POST /api/v1/auth/login")
        print('  {"email":"fleet.mgr1@demo.cat","role":"FLEET_MANAGER","companyId":1}')
        return 0
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"ERROR: {exc}", file=sys.stderr)
        import traceback

        traceback.print_exc()
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
