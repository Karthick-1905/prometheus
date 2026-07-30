# CAT Smart Rental Tracking

Clean monorepo layout:

```
cat/
├── Frontend/     # Vite + React UI
├── Backend/      # FastAPI + SQLAlchemy + ML services
└── docs/         # Product / architecture notes
```

## Architecture

```
Browser (Frontend :5173)
        │  /api/*
        ▼
FastAPI (Backend :8000)
  ├── services/anomaly_detection  (rules + Isolation Forest)
  ├── services/demand_forecasting (direct 4-week forecasts + verification)
  ├── services/ingestion
  └── SQLAlchemy → Neon PostgreSQL
```

## Quick start

### 1. Backend

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Ensure Backend/.env has Neon DATABASE_URL
alembic stamp 001_baseline   # if tables already exist from Prisma
# OR: alembic upgrade head   # fresh database

uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```powershell
cd Frontend
npm install
npm run dev
```

Open **http://localhost:5173**

## Migrated from

| Old path | New path |
|----------|----------|
| `src/app/*` (Next.js) | `Frontend/src/` |
| `python-ml/` | `Backend/app/services/anomaly_detection/` |
| `annomoly/` | `Backend/artifacts/` |
| `pipeline/` | `Backend/pipeline/` |
| `prisma/schema.prisma` | `Backend/app/models/` + Alembic |

Prisma was replaced by **SQLAlchemy models** + **Alembic** migrations (same Neon table names).

## Notes

- Old Next.js / mixed layout is archived under `_legacy/` (safe to delete once you confirm everything works).
- `Backend/venv` is the Python virtualenv — activate it before running the API.
- Model artifacts live in `Backend/artifacts/` (Isolation Forest joblib + training CSV).
- Demand forecasting benchmarks multiple models and baselines, promotes units and
  machine-hours independently, and publishes its time-aware evidence. See
  [`docs/demand-forecasting.md`](docs/demand-forecasting.md).
