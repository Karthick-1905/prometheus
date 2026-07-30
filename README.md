# CAT Smart Rental Tracking System

Real-time fleet monitoring and **hybrid anomaly detection** for Caterpillar equipment rentals.

MQTT telemetry → TypeScript ingestion → **rules + Python Isolation Forest** → PostgreSQL alerts → Next.js dashboard.

---

## What this project does

Companies rent CAT machines through dealers. This system:

1. **Ingests** live IoT telemetry over MQTT  
2. **Validates** packets (Zod) and stores them in Neon/PostgreSQL  
3. **Detects misuse / faults** with a hybrid pipeline:
   - **Rule-based** (10 deterministic thresholds)
   - **Isolation Forest** (scikit-learn, Python FastAPI)
4. **Surfaces** alerts and fleet status on a Next.js dashboard  

---

## Architecture

```
                    MQTT Broker (:1883)
                           │
                           ▼
              ┌────────────────────────┐
              │  TS Ingestion Service  │  npm run ingest
              │  Zod → Prisma → FE     │
              └───────────┬────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼                             ▼
   Rule Detector (TS)          Isolation Forest
   10 fixed rules              Python FastAPI :8000
           │                             │
           └──────────────┬──────────────┘
                          ▼
                 Hybrid Classifier
                          │
                          ▼
              Neon PostgreSQL (alerts)
                          │
                          ▼
              Next.js Dashboard :3000
```

Full detail: [docs/architecture.md](docs/architecture.md)

---

## Repository layout

```
cat/
├── src/                          # TypeScript app
│   ├── app/                      # Next.js UI + API routes
│   │   ├── page.tsx              # Fleet / anomaly dashboard
│   │   └── api/
│   │       ├── alerts/           # GET/PATCH anomaly alerts
│   │       └── telemetry/        # Fleet snapshot
│   ├── index.ts                  # MQTT ingestion entry
│   ├── lib/
│   │   ├── ml-client.ts          # HTTP client → Python ML
│   │   ├── mqtt/                 # MQTT client + subscriber
│   │   └── prisma.ts
│   ├── services/
│   │   ├── ingestion.service.ts
│   │   └── anomaly/
│   │       ├── anomaly.service.ts      # Hybrid orchestrator
│   │       ├── feature-engineering.ts
│   │       ├── rule-detector.ts        # 10 rules
│   │       ├── hybrid-classifier.ts
│   │       └── isolation-forest/       # LEGACY TS IF (not production)
│   ├── repositories/
│   ├── schemas/                  # Zod telemetry schema
│   └── types/
│
├── python-ml/                    # ★ Production Isolation Forest
│   ├── main.py                   # FastAPI server (:8000)
│   ├── generate_training_data.py
│   ├── train_and_eval.py
│   ├── test_predict_api.py
│   ├── model/trainer.py
│   ├── model/predictor.py
│   ├── routes/                   # /health /predict /train
│   └── requirements.txt
│
├── annomoly/                     # ML artifacts
│   ├── training-data.csv         # Generated labeled features
│   ├── isolation_forest.joblib   # Trained sklearn model
│   ├── scaler.joblib
│   └── model_meta.json           # Metrics + decision threshold
│
├── pipeline/                     # MQTT publisher + large telemetry CSV
├── scripts/
│   ├── generate_data.js          # Synthetic fleet CSV (90 days)
│   ├── seed-rental-data.ts       # Demo rental rows → DB
│   └── simulator.py              # Lightweight Paho MQTT publisher
│
├── prisma/schema.prisma          # DB schema
├── docs/                         # Problem statement + design notes
├── tests/test-payloads.ts
└── package.json
```

---

## Stack

| Layer | Tech |
|-------|------|
| Dashboard | Next.js 16, React 19 |
| Ingestion | Node.js, TypeScript, MQTT, Zod, Pino |
| Database | PostgreSQL (Neon), Prisma |
| ML | Python 3.12, FastAPI, scikit-learn IsolationForest |
| Messaging | MQTT (Mosquitto / HiveMQ) |

---

## Prerequisites

- Node.js 20+
- Python 3.11+
- MQTT broker (local Mosquitto recommended)
- PostgreSQL / Neon `DATABASE_URL`

---

## Quick start

### 1. Install

```bash
# Node
npm install

# Python ML deps
pip install -r python-ml/requirements.txt
```

### 2. Environment

Create `.env` in the project root:

```env
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require"
MQTT_BROKER_URL="mqtt://localhost:1883"
MQTT_TOPIC="telemetry/#"
MQTT_CLIENT_ID="cat-ingestion"
ML_SERVER_URL="http://localhost:8000"
NODE_ENV="development"
LOG_LEVEL="info"
```

### 3. Database

```bash
npm run db:generate
npm run db:push
# optional demo rentals:
npm run db:seed
```

### 4. Train Isolation Forest (Python)

```bash
npm run ml:train
# → builds ~15k-row training-data.csv
# → trains sklearn model on 14-dim features
# → writes annomoly/*.joblib + model_meta.json
```

**Last verified metrics (hold-out):**

| Metric | Value |
|--------|-------|
| Precision | ~82% |
| Recall | ~76% |
| F1 | ~79% |
| Accuracy | ~96% |

### 5. Run services (4 terminals)

```bash
# Terminal 1 — Python ML API
npm run ml:server
# http://localhost:8000/docs

# Terminal 2 — Ingestion + Dashboard
npm run dev
# Dashboard: http://localhost:3000

# Terminal 3 — MQTT publisher (needs broker + telemetry.csv)
# Generate CSV once if missing:
npm run data:telemetry
npm run sim:mqtt

# Or lightweight Python publisher:
npm run sim:python
```

### 6. Smoke-test ML API

```bash
npm run ml:test
```

---

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js + ingestion together |
| `npm run ingest` | Ingestion worker only |
| `npm run ml:train` | Generate data + train IF |
| `npm run ml:server` | FastAPI ML server |
| `npm run ml:test` | Hit `/health` + `/predict` |
| `npm run db:push` | Sync Prisma schema |
| `npm run db:seed` | Seed demo rental records |
| `npm run sim:mqtt` | Publish `pipeline/telemetry.csv` |
| `npm run typecheck` | `tsc --noEmit` |

---

## Anomaly detection

### Phase 2a — Rules (TypeScript)

| Severity | Type | Trigger |
|----------|------|---------|
| CRITICAL | `UNASSIGNED_OPERATOR` | Engine ON, no operator |
| CRITICAL | `ENGINE_OVERHEAT` | Temp > 105°C |
| CRITICAL | `SEVERE_VIBRATION` | Vib > 15 mm/s @ ≥90% load |
| CRITICAL | `FUEL_LEAK_THEFT` | Fuel drop > 10% / step |
| WARNING | `EXPIRED_RENTAL` | Status Overdue |
| WARNING | `MISSING_GPS` | Engine ON, no GPS |
| WARNING | `LOW_BATTERY` | Voltage < 11 V |
| WARNING | `ENGINE_HOURS_TAMPER` | Hours jump > 1 h / step |
| WARNING | `GEOFENCE_VIOLATION` | Outside site radius |
| INFO | `EXCESSIVE_IDLE` | Idle delta too high |

### Phase 2b — Isolation Forest (Python)

- **14 features**: fuel, hours, temp, pressure, battery, load, vibration, deltas, engineOn, geofence distance  
- Trained with **novelty detection** (normal-only fit) + F1-tuned threshold  
- Emits `STATISTICAL_OUTLIER` when the pattern is outside the learned envelope  

### Hybrid merge

- Rules only → `source=RULE`  
- IF only → `STATISTICAL_OUTLIER`  
- Both → severity elevated, tagged **HYBRID**  

---

## API surface

### Next.js

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | Recent anomaly alerts |
| PATCH | `/api/alerts` | Resolve alert `{ alertId }` |
| GET | `/api/telemetry` | Fleet snapshot |

### Python ML (`:8000`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + model loaded |
| POST | `/predict` | Score 14-dim feature vector |
| POST | `/train` | Retrain from CSV |
| GET | `/model/status` | Model metadata |
| GET | `/docs` | Swagger UI |

---

## MQTT payload (example)

```json
{
  "timestamp": "2026-07-30T09:05:00Z",
  "equipmentId": "CAT-EX-1001",
  "equipmentType": "Excavator",
  "dealerId": "D001",
  "siteId": "S003",
  "operatorId": "OP101",
  "engineStatus": "ON",
  "fuelLevel": 91.8,
  "engineHours": 452.4,
  "idleHours": 0.2,
  "speed": 14,
  "latitude": 11.02453,
  "longitude": 76.93531,
  "engineTemperature": 83,
  "hydraulicPressure": 208,
  "batteryVoltage": 13.8,
  "loadPercentage": 74,
  "vibrationLevel": 2.1,
  "rentalStatus": "Working"
}
```

Topic: `telemetry/#` (configurable via `MQTT_TOPIC`)

---

## Testing checklist

```bash
# 1. TypeScript
npm run typecheck

# 2. ML train + offline eval
npm run ml:train

# 3. ML HTTP API (server must be up)
npm run ml:server   # other terminal
npm run ml:test

# 4. MQTT edge cases (needs broker)
npm run test:payloads
```

---

## Design docs

| File | Content |
|------|---------|
| [docs/ps.txt](docs/ps.txt) | Problem statement / challenge brief |
| [docs/anaomoly.txt](docs/anaomoly.txt) | Hybrid pipeline sketch |
| [docs/architecture.md](docs/architecture.md) | Runtime architecture |
| [python-ml/README.md](python-ml/README.md) | ML service deep dive |
| [pipeline/README.md](pipeline/README.md) | Telemetry generator + publisher |

---

## Notes

- **Production Isolation Forest = Python** (`python-ml/`). The folder  
  `src/services/anomaly/isolation-forest/` is a **legacy TypeScript reference** only.  
- If the ML server is down, ingestion still works; rules run alone (`ml-client` fails open).  
- `pipeline/telemetry.csv` is large; regenerate with `npm run data:telemetry` if missing.  
- Folder name `annomoly/` is historical (typo for “anomaly”); keep as-is for path stability.

---

## License

Private / academic project — CAT Smart Rental Tracking System.
