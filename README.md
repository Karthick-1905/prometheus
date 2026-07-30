# CAT Smart Rental Tracking System

A full-stack **smart rental tracking platform** for Caterpillar-style construction and mining equipment.

It helps dealers, fleet managers, site teams, and operators:

- Track rented machines in near real time  
- Log runtime, idle, fuel, GPS, and health sensors  
- Detect misuse and failures with **rules + machine learning**  
- Plan demand with **four-week forecasts** (with uncertainty, not fake accuracy %)  
- Work inside **role-based dashboards** branded for CAT industrial operations  

This repository is the complete product prototype: **Frontend + Backend + ML artifacts + MQTT pipeline + Postgres models**.

---

## Table of contents

1. [Problem we solve](#1-problem-we-solve)  
2. [What the system does](#2-what-the-system-does)  
3. [Who uses it (roles)](#3-who-uses-it-roles)  
4. [High-level architecture](#4-high-level-architecture)  
5. [End-to-end data flow](#5-end-to-end-data-flow)  
6. [Frontend explained](#6-frontend-explained)  
7. [Backend explained](#7-backend-explained)  
8. [Anomaly detection (hybrid AI)](#8-anomaly-detection-hybrid-ai)  
9. [Demand forecasting](#9-demand-forecasting)  
10. [MQTT telemetry pipeline](#10-mqtt-telemetry-pipeline)  
11. [Database](#11-database)  
12. [Project structure](#12-project-structure)  
13. [How to run locally](#13-how-to-run-locally)  
14. [How to host (including free / hybrid)](#14-how-to-host-including-free--hybrid)  
15. [Configuration](#15-configuration)  
16. [API map](#16-api-map)  
17. [Tech stack](#17-tech-stack)  
18. [Further docs](#18-further-docs)  

---

## 1. Problem we solve

In construction and mining, companies often **rent** excavators, dozers, loaders, trucks, and generators through dealers instead of owning everything.

Today, much of that work is still:

- Spreadsheets and phone calls  
- Unclear location / operator assignment  
- Late returns and surprise rental cost  
- Idle machines nobody notices  
- Demand planned by gut feel  

That leads to lost assets, downtime, over-renting, and weak utilization.

**CAT Smart Rental Tracking** is designed as a digital control room for that rental lifecycle: track, log usage, alert on risk, and forecast demand — with humans still in control of decisions.

---

## 2. What the system does

### Real-time (or near-real-time) tracking

Equipment can send telemetry (engine, fuel, temp, vibration, GPS, rental status). The system stores it and surfaces fleet health on dashboards.

### Usage logging

Runtime hours, idle hours, fuel, location, and status history support utilization views, overdue logic, and anomaly scoring.

### Check-in / check-out

Site and operator flows support assignment and a **mock QR scan** path (camera integration can replace the mock later).

### Alerts & anomalies

- **Rule engine**: hard thresholds (overheat, fuel theft pattern, geofence, missing operator, …)  
- **Isolation Forest ML**: statistical outliers on rental usage patterns  
- Alerts are stored and listed for fleet review  

### Demand forecasting

Project-level and dealer-level **four-week** demand views, package options, and verification metrics. Forecasts are explicit about method and uncertainty — not a single “99% accurate” marketing number.

### Role-based workspaces

One product, four perspectives: Fleet Manager, Dealer, Site Manager, Operator — each with its own navigation and screens.

---

## 3. Who uses it (roles)

The UI starts with a **role selector** (demo RBAC). Role is stored in the browser (`localStorage` + React context). Routes outside that role’s area redirect to the correct home dashboard.

| Role | Job | Main screens |
|------|-----|----------------|
| **Fleet Manager** | Whole-fleet health | Dashboard KPIs, Assets, Utilization, Live Telemetry, Anomaly Detection |
| **Dealer** | Rentals & customers | Dashboard, Rental Operations, Equipment Inventory, Customers |
| **Site Manager** | One site’s machines & people | Dashboard, Operators, Equipment Assignment, Site Equipment |
| **Operator** | Daily machine work | Dashboard, Scan QR, Current Assignment, Activity History |

**Every role** also has Profile, Notifications, and Settings.

> Auth note: Backend already exposes JWT helpers for APIs. The login screen currently **simulates** identity via role only so UX and permissions can be demonstrated without a full user directory. Real JWT login can replace the selector later without throwing away the page tree.

---

## 4. High-level architecture

```
                    ┌──────────────────────────────────────┐
                    │           FRONTEND (Vite/React)       │
                    │  Role workspaces · CAT theme UI       │
                    │  Mock data + API-ready structure      │
                    └──────────────────┬───────────────────┘
                                       │ HTTPS / JSON
                                       ▼
                    ┌──────────────────────────────────────┐
                    │         BACKEND (FastAPI)             │
                    │  REST APIs · ingestion · ML score     │
                    │  demand · fleet · sites · dealers     │
                    └──────────────────┬───────────────────┘
                                       │ SQLAlchemy
                                       ▼
                    ┌──────────────────────────────────────┐
                    │     Neon PostgreSQL (cloud DB)        │
                    │  Equipment · Telemetry · Alerts ·     │
                    │  Rentals · Assignments · Forecasts    │
                    └──────────────────▲───────────────────┘
                                       │
         ┌─────────────────────────────┴─────────────────────┐
         │  OPTIONAL: MQTT PATH (often run locally)          │
         │                                                   │
         │  Devices / simulator ──MQTT──► Broker            │
         │                              │                    │
         │                              ▼                    │
         │                 mqtt_subscriber.py                │
         │                 (writes DB + runs anomalies)      │
         └───────────────────────────────────────────────────┘
```

| Layer | Responsibility |
|-------|----------------|
| **Frontend** | Role UX, dashboards, forms, mock/live presentation |
| **Backend** | Business rules, ML, persistence, HTTP APIs |
| **Postgres (Neon)** | Source of truth for fleet & alerts |
| **MQTT worker** | Edge/local ingest of live sensor streams |
| **Artifacts** | Trained Isolation Forest & demand models on disk |

---

## 5. End-to-end data flow

### Path A — MQTT (live / simulation broker)

1. Machine simulator or IoT gateway publishes JSON to MQTT  
   Topic pattern: `caterpillar/telemetry/#`  
2. Local process `Backend/pipeline/mqtt_subscriber.py` receives the message  
3. Payload is normalized (flat or nested GPS, etc.)  
4. `IngestionService` stores a telemetry row (when FK allows)  
5. `AnomalyDetectionService` runs **rules + Isolation Forest**  
6. Alerts are written to `AnomalyAlert` in Neon  
7. Hosted or local Frontend/API read fleet + alerts from the same database  

### Path B — HTTP simulate (no MQTT)

1. Client calls `POST /api/simulate` with a telemetry body  
2. Same ingestion + anomaly pipeline runs  
3. Useful for demos when the broker or worker is offline  

### Path C — Dashboard / planning only

1. User opens UI and picks a role  
2. Screens use mock data and/or REST endpoints (`/api/telemetry`, `/api/alerts`, `/api/demand/*`, fleet APIs, …)  
3. Demand and analytics services compute views from DB + synthetic/model artifacts  

---

## 6. Frontend explained

**Stack:** React 19 · Vite · React Router · shared CAT design tokens (yellow `#FFCD00` + charcoal shell) · Material Symbols  

### Mental model

```
Login (select role)
    → RoleLayout (sidebar + header)
        → Role-specific pages only
        → Common: Profile / Notifications / Settings
```

### Important folders

| Path | Purpose |
|------|---------|
| `Frontend/src/pages/Login.tsx` | Mock role selector |
| `Frontend/src/pages/fleet/*` | Fleet Manager world |
| `Frontend/src/pages/dealer/*` | Dealer world |
| `Frontend/src/pages/site/*` | Site Manager world |
| `Frontend/src/pages/operator/*` | Operator (mobile-friendly) |
| `Frontend/src/context/RoleContext.tsx` | Selected role persistence |
| `Frontend/src/types/roles.ts` | Nav config + route guards |
| `Frontend/src/routes/ProtectedRoute.tsx` | Blocks wrong-role URLs |
| `Frontend/src/mock/data.ts` | Placeholder datasets |
| `Frontend/src/components/layout/*` | Shell UI |
| `Frontend/src/components/ui/*` | Stat cards, panels, badges |
| `Frontend/src/styles/globals.css` | CAT theme tokens |

### Role navigation (product map)

**Fleet Manager**

- Dashboard — KPIs (fleet size, rentals, idle, maintenance, alerts), charts, AI-style recommendations panel  
- Assets — searchable equipment table (dealer, site, operator, fuel, hours)  
- Utilization — runtime vs idle, fuel, utilization %  
- Live Telemetry — per-machine sensor cards (mock/live-ready)  
- Anomaly Detection — catalog of alert types and active issues  

**Dealer**

- Dashboard — active / returned / available  
- Rental Operations — contracts list; New / Return / Extend (mock actions)  
- Equipment Inventory — dealer-owned fleet  
- Customers — account list  

**Site Manager**

- Dashboard — machines and operators on site  
- Operators — roster and shifts  
- Equipment Assignment — assign / check-in / check-out / reassign (mock)  
- Site Equipment — runtime, idle, fuel on site  

**Operator**

- Dashboard — assigned machine, site, shift, hours  
- Scan QR — mock scan result + Check In / Check Out  
- Current Assignment — live job ticket style summary  
- Activity History — previous days  

Design system details: **`DESIGN.md`**.

---

## 7. Backend explained

**Stack:** FastAPI · Uvicorn · Pydantic · SQLAlchemy 2 · Alembic · scikit-learn · paho-mqtt · optional Redis · PyJWT  

### Application entry

`Backend/app/main.py` builds the FastAPI app, enables CORS, loads the Isolation Forest on startup, and mounts routers.

### Service modules (`Backend/app/services/`)

| Service | Responsibility |
|---------|----------------|
| **ingestion** | Accept telemetry dict → optional DB row → trigger anomalies |
| **anomaly_detection** | Rules + IF predict/train + hybrid alert write |
| **demand_forecasting** | 4-week forecasts, packages, dealer views, verification |
| **fleet** | Fleet aggregates / live status helpers |
| **dealer** | Dealer-facing rental domain logic |
| **sites** | Site assignment / checkout-style operations |
| **analytics** | Analytics aggregations for dashboards |

### Other backend areas

| Path | Purpose |
|------|---------|
| `app/models/` | SQLAlchemy tables (domain + forecasting) |
| `app/schemas/` | Request/response Pydantic models |
| `app/api/routes/` | HTTP surface |
| `app/security/` | JWT + access helpers |
| `app/db/` | Engine, sessions |
| `artifacts/` | Joblib models + training CSV |
| `pipeline/` | MQTT subscriber & publishers |
| `alembic/` | Schema migrations |
| `tests/` | Pytest suite |
| `scripts/` | Train models, seed, generate data |

---

## 8. Anomaly detection (hybrid AI)

### Phase 1 — Rule engine

Deterministic checks on each packet (examples):

- Engine ON with no operator  
- Engine temperature above threshold  
- Severe vibration under high load  
- Rental overdue  
- Missing GPS while running  
- Low battery  
- Suspicious engine-hour jumps  
- Excessive idle step  
- Sudden fuel drop (leak / theft pattern)  
- Outside site geofence  

### Phase 2 — Isolation Forest

Trained sklearn model in `Backend/artifacts/`:

- `isolation_forest.joblib`  
- `scaler.joblib`  
- `model_meta.json` (decision threshold, metrics)  

Typical rental feature space (6-dim):

`engineHoursPerDay`, `idleHoursPerDay`, `rentalDays`, `hasOperator`, `hasSite`, `idleRatio`

API:

- `POST /api/ml/predict` — score one vector  
- `POST /api/ml/train` — retrain from CSV  
- `GET /api/ml/status` — model metadata  

### Phase 3 — Hybrid + persistence

Rules and ML findings are merged; alerts are stored as `AnomalyAlert` with type, severity, description, recommendation, and trigger values.

---

## 9. Demand forecasting

Demand module supports planning for **projects** and **dealers**:

- Four-week horizon forecasts (units and machine-hours handled carefully)  
- Package / flexibility style comparisons  
- Dealer regional demand and transfer-oriented views  
- Metrics and promotion gates so weak models fall back to baselines  

Important product rule: metrics on synthetic data are **engineering evidence**, not a claim of production CAT accuracy. Real promotion needs shadow evaluation on true requested demand.

Deep dive: **`docs/demand-forecasting.md`**.

---

## 10. MQTT telemetry pipeline

| Piece | Location |
|-------|----------|
| Subscriber worker | `Backend/pipeline/mqtt_subscriber.py` |
| Sample publisher | `Backend/pipeline/publish_telemetry.py` |
| Sample CSV | `Backend/pipeline/telemetry.csv` |

**Default topic:** `caterpillar/telemetry/#`  
**Broker env:** `MQTT_BROKER_URL` (e.g. `mqtt://localhost:1883` or HiveMQ)

### Recommended demo setup

- Host **Frontend + Backend + Neon** in the cloud (or free tiers)  
- Run **MQTT subscriber on your laptop** with the **same** `DATABASE_URL` as production  
- When the laptop is off, cloud dashboards still work from stored data; live MQTT pauses  

That hybrid model is intentional and cost-friendly.

---

## 11. Database

- **Engine:** PostgreSQL  
- **Hosted example:** Neon  
- **ORM:** SQLAlchemy  
- **Migrations:** Alembic (`Backend/alembic/versions/`)  

Core domain concepts (from the original rental schema):

- Dealers, Companies, Users  
- Equipment, Rental contracts, Assignments  
- Usage logs, Equipment telemetry  
- Anomaly alerts  
- Forecasting-related tables (demand module)  

Apply schema:

```bash
cd Backend
alembic upgrade head
```

---

## 12. Project structure

```
cat/
│
├── Frontend/                      # User interface
│   ├── src/
│   │   ├── pages/                 # All role screens + login
│   │   ├── components/            # Layout + shared UI
│   │   ├── context/               # Role state
│   │   ├── mock/                  # Demo data
│   │   ├── routes/                # Guards
│   │   ├── api/                   # HTTP client helpers
│   │   └── styles/                # CAT theme
│   ├── package.json
│   └── vite.config.ts
│
├── Backend/                       # API + ML + workers
│   ├── app/                       # FastAPI application code
│   ├── artifacts/                 # Trained models
│   ├── pipeline/                  # MQTT
│   ├── alembic/                   # DB migrations
│   ├── scripts/                   # Train / seed / generate
│   ├── tests/                     # Pytest
│   ├── requirements.txt
│   └── .env                       # Secrets (not committed)
│
├── docs/                          # Design & deploy guides
├── PRODUCT.md                     # Product principles
├── DESIGN.md                      # Visual system
└── README.md                      # This document
```

---

## 13. How to run locally

### Requirements

- Python 3.11+  
- Node.js 18+  
- Neon (or local) Postgres URL  
- Optional: MQTT broker  

### Backend

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Backend/.env must include DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

### Frontend

```powershell
cd Frontend
npm install
npm run dev
```

- App: http://localhost:5173  

### MQTT worker (optional)

```powershell
cd Backend
.\venv\Scripts\Activate.ps1
# same DATABASE_URL as API
python pipeline/mqtt_subscriber.py
```

### Tests

```powershell
cd Backend
pip install -r requirements-dev.txt
pytest
```

---

## 14. How to host (including free / hybrid)

| Component | Free-friendly choice | Start / build |
|-----------|----------------------|---------------|
| **Database** | Neon free | Connection string only |
| **Backend API** | Render free Web Service | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Frontend** | Cloudflare Pages / Netlify / Vercel | `npm run build` → publish `dist` |
| **MQTT worker** | Your PC | `python pipeline/mqtt_subscriber.py` |

Render backend settings:

- **Root Directory:** `Backend`  
- **Build:** `pip install -r requirements.txt`  
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`  

Set `DATABASE_URL`, `CORS_ORIGINS` (your frontend URL), `JWT_SECRET`, `ENVIRONMENT=production`.

Full hosting walkthrough: **`docs/hosting-render.md`**.

---

## 15. Configuration

### Backend environment (`Backend/.env`)

| Variable | Meaning |
|----------|---------|
| `DATABASE_URL` | Postgres / Neon URL |
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) |
| `JWT_SECRET` | Token signing secret |
| `ENVIRONMENT` | `development` or `production` |
| `REDIS_URL` | Optional live bus |
| `MQTT_BROKER_URL` | Used by MQTT worker process |

### Frontend

| Variable | Meaning |
|----------|---------|
| `VITE_API_URL` | Production API base URL for builds |

---

## 16. API map

| Area | Prefix / routes | Purpose |
|------|-----------------|---------|
| System | `GET /`, `GET /health` | Liveness + model load state |
| ML | `/api/ml/*` | Predict, train, model status |
| Alerts | `/api/alerts` | List / resolve anomaly alerts |
| Telemetry | `/api/telemetry`, `/api/simulate` | Fleet snapshot & synthetic ingest |
| Demand | `/api/demand/*` | Forecasts, packages, dealer, metrics |
| Auth | `/api/v1/auth` | JWT demo / token helpers |
| Fleet | `/api/v1/fleet` | Fleet dashboard APIs |
| Contracts | `/api/v1/contracts` | Rental contracts |
| Sites | `/api/v1/sites` | Site operations |
| Dealers | `/api/v1/dealers` | Dealer APIs |
| Live | `/api/v1/live` | Live status / SSE-related |
| Analytics | `/api/v1/analytics` | Analytics endpoints |

Always prefer **Swagger** at `/docs` as the live contract.

---

## 17. Tech stack

| Layer | Technologies |
|-------|----------------|
| UI | React, Vite, React Router, CSS design tokens, Material Symbols |
| API | FastAPI, Uvicorn, Pydantic Settings |
| Data | PostgreSQL, SQLAlchemy, Alembic, Neon |
| ML | scikit-learn Isolation Forest, joblib; demand model tournament |
| Streaming | MQTT (paho), optional Redis |
| Auth | JWT (backend); mock RBAC (frontend demo) |
| Quality | Pytest on backend |

---

## 18. Further docs

| Document | What it explains |
|----------|------------------|
| [`docs/hosting-render.md`](docs/hosting-render.md) | Deploy backend + MQTT + free tier notes |
| [`docs/demand-forecasting.md`](docs/demand-forecasting.md) | Forecast methods, verification, promotion |
| [`docs/architecture.md`](docs/architecture.md) | Pipeline architecture notes |
| [`docs/api-design.md`](docs/api-design.md) | API design background |
| [`docs/ps.txt`](docs/ps.txt) | Original problem statement / challenge brief |
| [`PRODUCT.md`](PRODUCT.md) | Product principles & voice |
| [`DESIGN.md`](DESIGN.md) | CAT visual language |
| [`Backend/README.md`](Backend/README.md) | Backend-focused readme |
| [`Frontend/README.md`](Frontend/README.md) | Frontend-focused readme |

---

## Design principles (product)

1. Lead with **operational outcome** (cost, availability, safety), not vanity metrics.  
2. Keep **demand, supply, and utilization** conceptually separate.  
3. Show **uncertainty / method**, not unsupported accuracy claims.  
4. Offer **lower-commitment alternatives** next to recommendations.  
5. Keep **humans in control** of consequential rental decisions.  

---

## Summary in one paragraph

**CAT Smart Rental Tracking** is a monorepo product that connects a Caterpillar-themed multi-role React frontend to a FastAPI backend on Neon Postgres. Telemetry can arrive over MQTT (often from a local worker) or HTTP simulation; hybrid rules + Isolation Forest produce alerts; demand forecasting supports planning; and each persona — fleet, dealer, site, operator — gets a purpose-built workspace. Host the web stack cheaply in the cloud, keep MQTT local if you want zero-cost live ingest, and grow toward full JWT auth and always-on workers when the demo becomes a service.

---

*Educational / prototype project inspired by Caterpillar rental operations. CAT and Caterpillar are trademarks of their respective owners.*
