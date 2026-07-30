"""Generate deterministic demand-forecasting demo data.

This script writes only explicitly requested output paths. Generated records are
synthetic and must not be presented as production performance.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.demand_forecasting.synthetic import generate_demo_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic demand demo data")
    parser.add_argument("--seed", type=int, default=20260730)
    parser.add_argument("--projects", type=int, default=28)
    parser.add_argument("--weeks", type=int, default=52)
    parser.add_argument(
        "--out",
        type=Path,
        default=BACKEND_ROOT / "artifacts" / "demand_forecasting" / "synthetic_weekly_demand.csv",
    )
    args = parser.parse_args()
    dataset = generate_demo_dataset(args.seed, args.projects, args.weeks)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    rows = [asdict(row) for row in dataset.weekly_demand]
    with args.out.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    manifest_path = args.out.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(dataset.manifest(), indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.out), "manifest": dataset.manifest()}, indent=2))


if __name__ == "__main__":
    main()
