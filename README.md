# CAT Fleet — Smart Rental Tracking & Anomaly Detection System

Real-time fleet monitoring, anomaly detection, and dashboard for Caterpillar equipment rentals.
Built on Next.js 16, TypeScript, Prisma (Neon PostgreSQL), MQTT, and Python FastAPI.

---

## Architecture Overview

```
                    ┌─────────────────────────────┐
                    │   MQTT Broker (localhost:1883)│
                    └────────────┬────────────────┘
                                 │  telemetry/#
                    ┌────────────▼────────────────┐
                    │  TypeScript Ingestion Service│   npm run ingest
                    │  (src/index.ts)              │
                    │                              │
                    │  ① Validate (Zod schema)     │
                    │  ② Persist to DB             │
                    │  ③ Feature Engineering       │
                    │  ④ Rule-Based Detection ─────┼──► 10 deterministic rules
                    │  ⑤ Isolation Forest ─────────┼──► Python ML Server (HTTP)
                    │  ⑥ Hybrid Classification     │
                    │  ⑦ Persist AnomalyAlerts     │
                    └────────────┬────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                   ▼
    ┌──────────────────┐  ┌────────────┐   ┌─────────────────┐
    │  Neon PostgreSQL │  │  Python    │   │  Next.js        │
    │  (Prisma ORM)    │  │  FastAPI   │   │  Dashboard      │
    │                  │  │  ML Server │   │  localhost:3000  │
    │  Tables:         │  │  :8000     │   │                 │
    │  - Equipment     │  │            │   │  /api/alerts    │
    │  - RentalContract│  │  /predict  │   │  /api/telemetry │
    │  - UsageLog      │  │  /train    │   │                 │
    │  - AnomalyAlert  │  │  /health   │   │  Auto-refresh   │
    └──────────────────┘  └────────────┘   │  5s polling     │
                                           └─────────────────┘
```

---

## Directory Structure

```
cat/
├── src/                        # TypeScript source (Next.js + Ingestion)
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Fleet anomaly dashboard
│   │   ├── globals.css         # Full design system
│   │   ├── layout.tsx
│   │   └── api/
│   │       ├── alerts/route.ts     # GET/PATCH anomaly alerts
│   │       └── telemetry/route.ts  # GET fleet snapshot
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client singleton
│   │   ├── logger.ts           # Pino structured logging
│   │   ├── ml-client.ts        # HTTP client → Python ML server
│   │   └── mqtt/
│   │       ├── client.ts
│   │       └── subscriber.ts
│   ├── services/
│   │   ├── ingestion.service.ts
│   │   └── anomaly/
│   │       ├── anomaly.service.ts      # Orchestrator (Phase 1–5)
│   │       ├── feature-engineering.ts  # Delta + spatial features
│   │       ├── rule-detector.ts        # 10 deterministic rules
│   │       ├── hybrid-classifier.ts    # Merge rule + IF findings
│   │       ├── types.ts
│   │       └── isolation-forest/       # TypeScript IF (archived reference)
│   ├── repositories/           # Prisma query helpers
│   ├── schemas/                # Zod validation
│   └── types/
│
├── python-ml/                  # Python FastAPI ML Server
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   ├── model/
│   │   ├── trainer.py          # Train IsolationForest from CSV
│   │   └── predictor.py        # Load model, score live vectors
│   ├── routes/
│   │   ├── health.py           # GET /health
│   │   ├── predict.py          # POST /predict
│   │   └── train.py            # POST /train, GET /model/status
│   ├── schemas/
│   │   └── telemetry.py        # Pydantic request/response models
│   └── README.md
│
├── annomoly/                   # Training data + model artifacts
│   ├── training-data.csv       # 15k 14-dim labeled rows (npm run ml:generate)
│   ├── isolation_forest.joblib # Trained sklearn IsolationForest
│   ├── scaler.joblib           # StandardScaler
│   └── model_meta.json         # Threshold + hold-out metrics
│
├── prisma/
│   ├── schema.prisma           # DB schema (Equipment, UsageLog, AnomalyAlert...)
│   └── migrations/
│
├── pipeline/
│   └── publish_telemetry.js    # MQTT test publisher
│
├── scripts/
│   ├── generate_data.js        # Synthetic dataset generator
│   ├── seed-rental-data.ts     # Seeds 100 records + exports CSV
│   └── train-isolation-forest.ts  # (Legacy TS trainer — use Python instead)
│
├── docs/                       # Design documents
├── .env                        # Environment variables
└── package.json
```

---

## Quick Start

### 1. Install dependencies

```bash
# TypeScript / Next.js
npm install

# Python ML server
cd python-ml
pip install -r requirements.txt
cd ..
```

### 2. Configure environment

```bash
# .env (already configured)
DATABASE_URL="postgresql://..."
MQTT_BROKER_URL="mqtt://localhost:1883"
ML_SERVER_URL="http://localhost:8000"
```

### 3. Sync database schema

```bash
npm run db:push
```

### 4. Generate training data + train Isolation Forest (Python)

```bash
# One shot: generate 15k labeled rows + train sklearn model + evaluate
npm run ml:train

# Artifacts written to annomoly/:
#   training-data.csv, isolation_forest.joblib, scaler.joblib, model_meta.json
```

Optional DB seed (rental dashboard demo, separate from ML features):

```bash
npm run seed:data
```

### 5. Start / retrain the ML server

```bash
npm run ml:server
# → http://localhost:8000  |  docs: /docs

# Re-train via API after CSV refresh:
# curl -X POST http://localhost:8000/train

# Smoke-test predictions:
npm run ml:test
```

### 6. Start all services

```bash
# Terminal 1 — Python ML Server
cd python-ml && python main.py

# Terminal 2 — TypeScript Ingestion Service
npm run ingest

# Terminal 3 — MQTT Test Publisher
node pipeline/publish_telemetry.js

# Terminal 4 — Next.js Dashboard
npm run dev
# Open: http://localhost:3000
```

---

## Anomaly Detection Pipeline

| Phase | Component | Technology | Description |
|-------|-----------|------------|-------------|
| 1 | Feature Engineering | TypeScript (in-process) | Computes fuelDelta, engineHoursDelta, GPS distance |
| 2a | Rule-Based Detection | TypeScript (in-process) | 10 deterministic threshold rules |
| 2b | Isolation Forest | **Python FastAPI** | Statistical outlier scoring via scikit-learn |
| 3 | Hybrid Classification | TypeScript (in-process) | Merges rule + IF findings, elevates co-detected severity |
| 4 | Persist | Prisma → Neon PostgreSQL | Saves AnomalyAlert rows |
| 5 | Dashboard | Next.js + React | Auto-refreshing alert table + fleet grid |

### The 10 Rule-Based Anomalies

| Severity | Rule | Trigger |
|----------|------|---------|
| 🔴 CRITICAL | UNASSIGNED_OPERATOR | Engine ON + no operator |
| 🔴 CRITICAL | ENGINE_OVERHEAT | Temp > 105°C |
| 🔴 CRITICAL | SEVERE_VIBRATION | Vibration > 15 mm/s at ≥90% load |
| 🔴 CRITICAL | FUEL_LEAK_THEFT | Fuel drop > 10% in 5 min |
| 🟡 WARNING | EXPIRED_RENTAL | rentalStatus = Overdue |
| 🟡 WARNING | MISSING_GPS | Engine ON + no GPS fix |
| 🟡 WARNING | LOW_BATTERY | Battery < 11.0V |
| 🟡 WARNING | ENGINE_HOURS_TAMPER | Engine hours jump > 1hr in 5 min |
| 🟡 WARNING | GEOFENCE_VIOLATION | > 0.05° from site center |
| 🔵 INFO | EXCESSIVE_IDLE | Idle hours > 1hr in 5 min |

---

## npm Scripts

```bash
npm run dev          # Start Next.js dashboard (localhost:3000)
npm run ingest       # Start TypeScript MQTT ingestion service
npm run seed:data    # Generate 100 rental records + export CSV
npm run db:push      # Sync Prisma schema → Neon DB
npm run db:generate  # Regenerate Prisma Client
npm run build        # Production build
npm run lint         # ESLint
```
