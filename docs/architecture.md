# Architecture

## Hybrid anomaly pipeline

```
MQTT Broker
    │  telemetry/#
    ▼
TypeScript Ingestion  (npm run ingest)
    │  1. JSON parse + Zod validate
    │  2. Persist Equipment + EquipmentTelemetry
    │  3. Feature engineering (deltas, geofence)
    │  4a. Rule detector (10 deterministic rules)
    │  4b. HTTP POST → Python ML /predict  (Isolation Forest)
    │  5. Hybrid classifier (merge / elevate)
    │  6. Persist AnomalyAlert
    ▼
Neon PostgreSQL
    │
    ├── /api/alerts      → Dashboard alerts table
    └── /api/telemetry   → Fleet snapshot
```

## Services

| Service | Port | Command |
|---------|------|---------|
| Next.js dashboard | 3000 | `npm run dev:next` |
| Ingestion worker | — | `npm run ingest` |
| Python ML API | 8000 | `npm run ml:server` |
| MQTT broker | 1883 | Mosquitto / HiveMQ |

## Isolation Forest (Python)

- Train: `npm run ml:train` → `annomoly/isolation_forest.joblib`
- Features: 14-dim live vector (same as TypeScript feature engineering)
- Score: `decision_function < tuned threshold` from `model_meta.json`

TypeScript IF under `src/services/anomaly/isolation-forest/` is **legacy only**.
