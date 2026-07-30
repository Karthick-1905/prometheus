"""Deterministic synthetic demand data for development and demonstrations.

The generator models customer need before dealer fulfillment. Every result is
tagged synthetic and is unsuitable for business-performance claims.
"""
from __future__ import annotations

import hashlib
import math
import random
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from typing import Any


REGIONS = ["North", "South", "East", "West"]
PROJECT_TYPES = [
    "Commercial Building",
    "Mine Expansion",
    "Road Construction",
    "Quarry Development",
    "Pipeline",
    "Public Infrastructure",
]
PHASES = [
    "Mobilization",
    "Clearing",
    "Excavation",
    "Earthwork",
    "Structural",
    "Finishing",
    "Demobilization",
]
EQUIPMENT_TYPES = [
    "Excavator",
    "Bulldozer",
    "Wheel Loader",
    "Crane",
    "Motor Grader",
    "Compactor",
    "Dump Truck",
]

PHASE_AFFINITY: dict[str, dict[str, float]] = {
    "Mobilization": {"Wheel Loader": 1.0, "Dump Truck": 0.8, "Excavator": 0.5},
    "Clearing": {"Bulldozer": 1.4, "Excavator": 1.0, "Wheel Loader": 0.8},
    "Excavation": {"Excavator": 1.8, "Dump Truck": 1.2, "Bulldozer": 0.8},
    "Earthwork": {
        "Bulldozer": 1.5,
        "Wheel Loader": 1.3,
        "Excavator": 1.0,
        "Motor Grader": 0.9,
        "Compactor": 0.8,
    },
    "Structural": {"Crane": 1.7, "Wheel Loader": 0.7},
    "Finishing": {"Motor Grader": 1.2, "Compactor": 1.3, "Wheel Loader": 0.5},
    "Demobilization": {"Wheel Loader": 0.5, "Dump Truck": 0.4},
}

PROJECT_TYPE_BONUS: dict[str, dict[str, float]] = {
    "Road Construction": {"Motor Grader": 1.0, "Compactor": 1.1, "Bulldozer": 0.6},
    "Mine Expansion": {"Excavator": 0.8, "Dump Truck": 1.0, "Wheel Loader": 0.7},
    "Commercial Building": {"Crane": 0.9, "Excavator": 0.4},
    "Quarry Development": {"Excavator": 0.8, "Wheel Loader": 0.9, "Dump Truck": 0.7},
    "Pipeline": {"Excavator": 0.7, "Bulldozer": 0.5},
    "Public Infrastructure": {"Crane": 0.5, "Motor Grader": 0.6, "Compactor": 0.5},
}

EXPECTED_HOURS_PER_UNIT_WEEK = {
    "Excavator": 48.0,
    "Bulldozer": 46.0,
    "Wheel Loader": 44.0,
    "Crane": 40.0,
    "Motor Grader": 42.0,
    "Compactor": 45.0,
    "Dump Truck": 52.0,
}


def monday_on_or_before(value: date) -> date:
    return value - timedelta(days=value.weekday())


@dataclass(frozen=True)
class ProjectSpec:
    project_id: int
    customer_id: int
    site_id: int
    project_code: str
    project_name: str
    project_type: str
    project_size: float
    project_size_unit: str
    region: str
    current_phase: str
    phase_start_date: date
    phase_end_date: date
    expected_project_end: date
    project_status: str
    progress_percentage: float
    priority: str = "STANDARD"
    scenario: str | None = None


@dataclass(frozen=True)
class WeeklyDemand:
    week_start: date
    customer_id: int
    project_id: int
    site_id: int
    project_type: str
    project_size: float
    project_size_unit: str
    region: str
    project_phase: str
    equipment_type: str
    requested_units: int
    fulfilled_units: int
    rented_units: int
    engine_hours: float
    idle_hours: float
    rented_days: int
    request_count: int
    machine_days: float
    project_status: str
    is_synthetic: bool = True


@dataclass(frozen=True)
class InventoryUnit:
    equipment_id: str
    equipment_type: str
    current_region: str
    status: str
    available_from: date
    expected_return_date: date | None
    equipment_capacity: str = "STANDARD"
    equipment_model: str = "CAT Demo"


@dataclass(frozen=True)
class PackageSpec:
    package_code: str
    package_name: str
    equipment_type: str
    billing_model: str
    duration_days: int
    included_units: int
    included_hours: float
    base_charge: float
    extra_hour_charge: float
    minimum_commitment: int
    cancellation_policy: str
    flexibility_score: float
    description: str
    version: str = "SIM-2026.1"
    simulated_pricing: bool = True


@dataclass(frozen=True)
class DemoDataset:
    seed: int
    as_of: date
    projects: tuple[ProjectSpec, ...]
    weekly_demand: tuple[WeeklyDemand, ...]
    inventory: tuple[InventoryUnit, ...]
    packages: tuple[PackageSpec, ...]

    def manifest(self) -> dict[str, Any]:
        payload = "|".join(
            f"{row.project_id}:{row.equipment_type}:{row.week_start}:{row.requested_units}"
            for row in self.weekly_demand
        )
        return {
            "seed": self.seed,
            "asOf": self.as_of.isoformat(),
            "projectCount": len(self.projects),
            "weeklyRowCount": len(self.weekly_demand),
            "inventoryUnitCount": len(self.inventory),
            "packageCount": len(self.packages),
            "sha256": hashlib.sha256(payload.encode("utf-8")).hexdigest(),
            "synthetic": True,
            "warning": "Synthetic demo behavior; not measured business performance.",
        }


def _phase_for_progress(progress: float) -> str:
    boundaries = [
        (0.08, "Mobilization"),
        (0.18, "Clearing"),
        (0.36, "Excavation"),
        (0.58, "Earthwork"),
        (0.78, "Structural"),
        (0.93, "Finishing"),
    ]
    for boundary, phase in boundaries:
        if progress < boundary:
            return phase
    return "Demobilization"


def _size_factor(size: float) -> float:
    return max(0.65, min(2.4, math.sqrt(size / 100.0)))


def _active_demo_projects(as_of: date) -> list[ProjectSpec]:
    monday = monday_on_or_before(as_of)
    return [
        ProjectSpec(
            1, 1, 1, "PRJ-OVERRENT", "Riverside Commercial Tower",
            "Commercial Building", 180, "thousand_sq_ft", "South", "Earthwork",
            monday - timedelta(weeks=4), monday + timedelta(weeks=3),
            monday + timedelta(weeks=16), "ACTIVE", 44, scenario="OVER_RENTING",
        ),
        ProjectSpec(
            2, 1, 2, "PRJ-SHORTAGE", "Kalinga Mine Expansion",
            "Mine Expansion", 260, "hectares", "East", "Excavation",
            monday - timedelta(weeks=2), monday + timedelta(weeks=5),
            monday + timedelta(weeks=24), "ACTIVE", 31, "CRITICAL", "SHORTAGE_RISK",
        ),
        ProjectSpec(
            3, 1, 3, "PRJ-STABLE", "Western Bypass Package 3",
            "Road Construction", 140, "lane_km", "West", "Earthwork",
            monday - timedelta(weeks=6), monday + timedelta(weeks=4),
            monday + timedelta(weeks=18), "ACTIVE", 52, scenario="STABLE",
        ),
        ProjectSpec(
            4, 1, 4, "PRJ-COLD", "North Metro Depot",
            "Public Infrastructure", 200, "thousand_sq_ft", "North", "Mobilization",
            monday + timedelta(weeks=1), monday + timedelta(weeks=3),
            monday + timedelta(weeks=28), "PLANNED", 0, scenario="COLD_START",
        ),
        ProjectSpec(
            5, 1, 5, "PRJ-SPIKE", "Southern Pipeline Crossing",
            "Pipeline", 95, "route_km", "South", "Excavation",
            monday - timedelta(weeks=1), monday + timedelta(weeks=2),
            monday + timedelta(weeks=10), "ACTIVE", 38, scenario="TEMPORARY_SPIKE",
        ),
    ]


def _historical_projects(
    rng: random.Random,
    as_of: date,
    project_count: int,
) -> list[ProjectSpec]:
    projects: list[ProjectSpec] = []
    for offset in range(max(0, project_count - 5)):
        project_id = 100 + offset
        duration_weeks = rng.randint(24, 44)
        end_week = monday_on_or_before(as_of) - timedelta(weeks=rng.randint(5, 30))
        start_week = end_week - timedelta(weeks=duration_weeks)
        project_type = PROJECT_TYPES[offset % len(PROJECT_TYPES)]
        region = REGIONS[(offset * 3) % len(REGIONS)]
        size = float(rng.randint(70, 320))
        projects.append(
            ProjectSpec(
                project_id=project_id,
                customer_id=1 + (offset % 4),
                site_id=1 + (offset % 10),
                project_code=f"HIST-{project_id}",
                project_name=f"Completed {project_type} {offset + 1}",
                project_type=project_type,
                project_size=size,
                project_size_unit="normalized_demo_units",
                region=region,
                current_phase="Demobilization",
                phase_start_date=end_week - timedelta(weeks=3),
                phase_end_date=end_week,
                expected_project_end=end_week,
                project_status="COMPLETED",
                progress_percentage=100,
            )
        )
    return projects


def _equipment_for_project(project: ProjectSpec) -> list[str]:
    scores: list[tuple[float, str]] = []
    for equipment in EQUIPMENT_TYPES:
        score = max(PHASE_AFFINITY.get(phase, {}).get(equipment, 0) for phase in PHASES)
        score += PROJECT_TYPE_BONUS.get(project.project_type, {}).get(equipment, 0)
        scores.append((score, equipment))
    scores.sort(reverse=True)
    chosen = [equipment for score, equipment in scores[:4] if score > 0]
    return chosen or ["Excavator", "Wheel Loader"]


def _generate_history_for_project(
    project: ProjectSpec,
    rng: random.Random,
    as_of: date,
    max_weeks: int,
) -> list[WeeklyDemand]:
    if project.scenario == "COLD_START":
        return []

    if project.project_status == "COMPLETED":
        project_end = monday_on_or_before(project.expected_project_end)
        duration = min(max_weeks, max(18, int((project.expected_project_end - (
            project.expected_project_end - timedelta(weeks=max_weeks)
        )).days / 7)))
        start = project_end - timedelta(weeks=duration - 1)
        week_count = duration
    else:
        week_count = 12
        start = monday_on_or_before(as_of) - timedelta(weeks=week_count)

    equipment_types = _equipment_for_project(project)
    if project.scenario == "OVER_RENTING":
        equipment_types = ["Excavator", "Wheel Loader"]
    elif project.scenario == "SHORTAGE_RISK":
        equipment_types = ["Excavator", "Dump Truck", "Wheel Loader"]
    elif project.scenario == "STABLE":
        equipment_types = ["Motor Grader", "Compactor", "Bulldozer"]
    elif project.scenario == "TEMPORARY_SPIKE":
        equipment_types = ["Excavator", "Bulldozer"]

    rows: list[WeeklyDemand] = []
    for week_index in range(week_count):
        week = start + timedelta(weeks=week_index)
        progress = (week_index + 1) / max(week_count, 1)
        phase = (
            project.current_phase
            if project.project_status != "COMPLETED" and week_index >= week_count - 5
            else _phase_for_progress(progress)
        )
        for equipment in equipment_types:
            affinity = PHASE_AFFINITY.get(phase, {}).get(equipment, 0.12)
            type_bonus = PROJECT_TYPE_BONUS.get(project.project_type, {}).get(equipment, 0)
            seasonal = 0.88 + 0.16 * math.sin((week.isocalendar().week / 52) * math.tau)
            trend = 1.0 + (0.16 * progress if project.project_type == "Mine Expansion" else 0)
            raw = (_size_factor(project.project_size) * (affinity + type_bonus) * seasonal * trend)
            requested = max(0, int(round(raw + rng.uniform(-0.5, 0.7))))

            if rng.random() < 0.08:
                requested = 0

            if project.scenario == "OVER_RENTING" and equipment == "Excavator":
                requested = 2
            elif project.scenario == "SHORTAGE_RISK" and equipment == "Excavator":
                requested = max(1, 1 + week_index // 3)
                if week_index >= week_count - 3:
                    requested = 3 + (week_index - (week_count - 3))
            elif project.scenario == "STABLE" and equipment == "Motor Grader":
                requested = 2
            elif project.scenario == "TEMPORARY_SPIKE" and equipment == "Excavator":
                requested = 2 if week_index < week_count - 2 else 3

            fulfilled = requested
            if requested > 0 and rng.random() < 0.16:
                fulfilled = max(0, requested - 1)
            rented = fulfilled
            hours_capacity = EXPECTED_HOURS_PER_UNIT_WEEK[equipment] * max(rented, 1)
            utilization = rng.uniform(0.55, 0.86)
            if project.scenario == "OVER_RENTING" and equipment == "Excavator":
                utilization = rng.uniform(0.28, 0.38)
                rented = max(rented, 2)
            elif project.scenario == "SHORTAGE_RISK" and equipment == "Excavator":
                utilization = rng.uniform(0.82, 0.91)
            elif project.scenario == "STABLE":
                utilization = rng.uniform(0.66, 0.73)

            engine_hours = round(hours_capacity * utilization if rented else 0, 2)
            idle_hours = round(
                max(0.0, hours_capacity - engine_hours) * rng.uniform(0.55, 0.9)
                if rented else 0,
                2,
            )
            rows.append(
                WeeklyDemand(
                    week_start=week,
                    customer_id=project.customer_id,
                    project_id=project.project_id,
                    site_id=project.site_id,
                    project_type=project.project_type,
                    project_size=project.project_size,
                    project_size_unit=project.project_size_unit,
                    region=project.region,
                    project_phase=phase,
                    equipment_type=equipment,
                    requested_units=requested,
                    fulfilled_units=min(fulfilled, requested),
                    rented_units=min(rented, fulfilled),
                    engine_hours=engine_hours,
                    idle_hours=idle_hours,
                    rented_days=min(7, 5 + int(rng.random() > 0.4)) if rented else 0,
                    request_count=1 if requested else 0,
                    machine_days=round(rented * 6.0, 2),
                    project_status=project.project_status,
                )
            )
    return rows


def _generate_inventory(rng: random.Random, as_of: date) -> list[InventoryUnit]:
    units: list[InventoryUnit] = []
    counter = 1
    base_counts = {
        "North": 4,
        "South": 5,
        "East": 3,
        "West": 7,
    }
    for region in REGIONS:
        for equipment in EQUIPMENT_TYPES:
            count = base_counts[region]
            if region == "East" and equipment == "Excavator":
                count = 2
            if region == "West" and equipment == "Excavator":
                count = 9
            for index in range(count):
                roll = rng.random()
                status = "AVAILABLE"
                expected_return = None
                available_from = as_of
                if roll < 0.16:
                    status = "RESERVED"
                    available_from = as_of + timedelta(weeks=2)
                elif roll < 0.27:
                    status = "RENTED"
                    expected_return = as_of + timedelta(days=rng.randint(5, 18))
                    available_from = expected_return
                elif roll < 0.34:
                    status = "MAINTENANCE"
                    available_from = as_of + timedelta(days=rng.randint(8, 24))
                units.append(
                    InventoryUnit(
                        equipment_id=f"DEMO-{counter:04d}",
                        equipment_type=equipment,
                        current_region=region,
                        status=status,
                        available_from=available_from,
                        expected_return_date=expected_return,
                    )
                )
                counter += 1
    return units


def _generate_packages() -> list[PackageSpec]:
    packages: list[PackageSpec] = []
    cost_factor = {
        "Excavator": 1.25,
        "Bulldozer": 1.2,
        "Wheel Loader": 1.0,
        "Crane": 1.5,
        "Motor Grader": 1.1,
        "Compactor": 0.8,
        "Dump Truck": 1.15,
    }
    definitions = [
        ("PAYG", "Pay Per Use", "PAY_PER_USE", 7, 1, 0, 900, 135, 0, "Cancel any time", 1.0,
         "Lowest commitment for uncertain or intermittent work."),
        ("FLEX", "Weekly Flex", "WEEKLY", 7, 1, 38, 4300, 95, 7, "Cancel before the next week", 0.88,
         "One flexible weekly unit with an on-demand extension."),
        ("MONTHLY", "Monthly Reserved", "MONTHLY", 28, 2, 320, 24500, 72, 28, "Seven-day cancellation notice", 0.38,
         "Reserved capacity for sustained work."),
        ("HIGHUTIL", "High-Utilization Bundle", "MONTHLY", 28, 2, 420, 28200, 55, 28, "Fourteen-day cancellation notice", 0.25,
         "Lower extra-hour charge for consistently busy equipment."),
        ("BUFFER", "Reserved Base + On-Demand Buffer", "HYBRID", 28, 1, 190, 15400, 82, 14, "Base is committed; buffer is flexible", 0.72,
         "Protect core demand without committing to every possible peak."),
        ("ADDON", "Short-Term Demand Add-On", "ADD_ON", 7, 1, 45, 5200, 105, 7, "Non-refundable after dispatch", 0.82,
         "Temporary extra capacity for a short forecast peak."),
    ]
    for equipment in EQUIPMENT_TYPES:
        factor = cost_factor[equipment]
        slug = equipment.upper().replace(" ", "_")
        for code, name, billing, duration, units, hours, base, extra, commitment, cancellation, flex, desc in definitions:
            packages.append(
                PackageSpec(
                    package_code=f"{slug}_{code}",
                    package_name=name,
                    equipment_type=equipment,
                    billing_model=billing,
                    duration_days=duration,
                    included_units=units,
                    included_hours=hours,
                    base_charge=round(base * factor, 2),
                    extra_hour_charge=round(extra * factor, 2),
                    minimum_commitment=commitment,
                    cancellation_policy=cancellation,
                    flexibility_score=flex,
                    description=desc,
                )
            )
    return packages


def generate_demo_dataset(
    seed: int = 20260730,
    project_count: int = 28,
    weeks: int = 52,
    as_of: date | None = None,
) -> DemoDataset:
    effective_as_of = monday_on_or_before(as_of or date.today())
    rng = random.Random(seed)
    projects = _active_demo_projects(effective_as_of)
    projects.extend(_historical_projects(rng, effective_as_of, project_count))
    rows: list[WeeklyDemand] = []
    for project in projects:
        project_rng = random.Random(seed * 1009 + project.project_id)
        rows.extend(_generate_history_for_project(project, project_rng, effective_as_of, weeks))
    rows.sort(key=lambda row: (row.week_start, row.project_id, row.equipment_type))
    return DemoDataset(
        seed=seed,
        as_of=effective_as_of,
        projects=tuple(projects),
        weekly_demand=tuple(rows),
        inventory=tuple(_generate_inventory(rng, effective_as_of)),
        packages=tuple(_generate_packages()),
    )


def dataset_as_json(dataset: DemoDataset) -> dict[str, Any]:
    def encode(value: Any) -> Any:
        if isinstance(value, date):
            return value.isoformat()
        return value

    return {
        "manifest": dataset.manifest(),
        "projects": [
            {key: encode(value) for key, value in asdict(project).items()}
            for project in dataset.projects
        ],
        "weeklyDemand": [
            {key: encode(value) for key, value in asdict(row).items()}
            for row in dataset.weekly_demand
        ],
        "inventory": [
            {key: encode(value) for key, value in asdict(unit).items()}
            for unit in dataset.inventory
        ],
        "packages": [asdict(package) for package in dataset.packages],
    }
