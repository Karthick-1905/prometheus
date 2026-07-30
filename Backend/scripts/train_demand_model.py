"""Train and chronologically validate the demand-forecasting demo models."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.demand_forecasting.modeling import (  # noqa: E402
    save_demand_bundle,
    train_demand_bundle,
)
from app.services.demand_forecasting.synthetic import generate_demo_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Train demand models on synthetic demo data")
    parser.add_argument("--seed", type=int, default=20260730)
    parser.add_argument("--n-estimators", type=int, default=160)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=BACKEND_ROOT / "artifacts" / "demand_forecasting",
    )
    args = parser.parse_args()
    dataset = generate_demo_dataset(seed=args.seed)
    bundle = train_demand_bundle(
        dataset,
        n_estimators=args.n_estimators,
        random_state=args.random_state,
    )
    metadata = save_demand_bundle(bundle, args.out_dir)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
