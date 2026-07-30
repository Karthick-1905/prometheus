# Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `generate_data.js` | `npm run data:telemetry` | Build large `pipeline/telemetry.csv` (fleet sim) |
| `seed-rental-data.ts` | `npm run db:seed` | Demo rentals → DB + small CSV export |
| `simulator.py` | `npm run sim:python` | Lightweight MQTT publisher (Paho) |
| `test_isolation_forest.ts` | `npm run test:if-legacy` | Legacy TS Isolation Forest offline test |
| `train-isolation-forest.ts` | — | **Deprecated** — use `npm run ml:train` |

Production ML train/eval lives in **`python-ml/`**, not here.
