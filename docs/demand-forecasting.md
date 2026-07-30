# Demand forecasting: operation and verification

## Accuracy boundary

The current artifact is a deterministic proof of concept trained and evaluated on
synthetic rental-request history. Its scores verify the pipeline, time ordering,
fallbacks, and promotion rules. They do **not** establish accuracy on Caterpillar
or customer demand.

Production promotion is blocked until the same verification workflow is run in
shadow mode on real **requested demand**, including unfulfilled requests. Fulfilled
rentals alone are supply-constrained and must not be treated as true demand.

## Serving strategy

Forecasts are generated directly for weeks 1, 2, 3, and 4 from the latest observed
history. Week 2 never consumes the week-1 prediction, which avoids recursive error
propagation. Units and machine-hours select and promote methods independently.

The tournament includes:

- Last observed value
- Four-week moving average
- Recency-weighted four-week moving average
- Project-phase/equipment cohort average
- Histogram gradient boosting
- Gradient boosting
- Random forest
- Poisson regression for equipment units

The selection objective is horizon-weighted MAE with weights `4, 3, 2, 1`, giving
the first forecast week the strongest influence. A model selected in the
development window is promoted only when it also meets or beats the selected
baseline on the untouched final chronological holdout. Otherwise the baseline is
served.

## Verification design

The generated `model_meta.json` includes:

- A development window, a separate selection/calibration window, and an untouched
  final chronological holdout
- Three rolling-origin evaluations
- MAE, horizon-weighted MAE, WAPE, bias, underforecast rate, overforecast rate,
  and shortage-weighted error
- Results by horizon, equipment type, project phase, and region
- Prediction-interval coverage on the final holdout
- A project-level cold-start test where complete projects are excluded from
  training and predicted through the comparable-cohort fallback
- Every candidate and baseline score plus the promotion decision

The deterministic artifact generated on 2026-07-30 serves:

- Equipment units: `LAST_OBSERVED` because the selected random forest failed the
  final promotion gate (`0.5521` versus `0.5181` horizon-weighted MAE)
- Machine-hours: `GRADIENT_BOOSTING` because it passed the final promotion gate
  (`18.0649` versus `18.7570` horizon-weighted MAE)

These values are synthetic engineering evidence only. The system deliberately
does not display an unsupported “accuracy percentage.”

## Reproduce locally

From `Backend`:

```powershell
.\venv\Scripts\python.exe scripts\generate_demand_demo_data.py
.\venv\Scripts\python.exe scripts\train_demand_model.py --n-estimators 120
.\venv\Scripts\python.exe -m pytest tests -q
```

Inspect:

- `Backend/artifacts/demand_forecasting/model_meta.json`
- `GET /api/demand/status`
- `GET /api/demand/metrics` with `X-User-Role: SYSTEM_ADMINISTRATOR`

Synthetic generation is seeded, and its manifest includes a SHA-256 digest so a
reviewer can confirm that two runs used the same input.

## Production gate

Before any real customer recommendation is automated:

1. Ingest immutable rental requests, cancellations, rejections, partial
   fulfilment, extensions, and peak concurrent requirement.
2. Backfill project phase and forecast-time project attributes.
3. Run at least 8–12 weeks of shadow forecasts without affecting reservations.
4. Compare all candidates with the same time-aware workflow and report segments
   with enough observations.
5. Define business acceptance limits for shortage-weighted error, interval
   coverage, and critical-equipment underforecasting.
6. Require model-risk and product-owner approval before changing from advisory to
   operational use.
