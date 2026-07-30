# CAT Smart Rental — Backend

FastAPI + SQLAlchemy + Alembic + Isolation Forest (Neon PostgreSQL).

## Layout

```
Backend/
├── app/
│   ├── main.py                 # FastAPI entry
│   ├── config.py               # env / DATABASE_URL
│   ├── db/                     # engine + session
│   ├── models/                 # SQLAlchemy (from prisma schema)
│   ├── schemas/                # Pydantic
│   ├── api/routes/             # HTTP routes
│   └── services/
│       ├── anomaly_detection/  # rules + IF train/predict
│       ├── demand_forecasting/ # direct forecasts, validation, recommendations
│       └── ingestion/          # telemetry pipeline
├── artifacts/                  # joblib model + training CSV
├── alembic/                    # migrations
├── pipeline/                   # telemetry publisher assets
├── scripts/                    # train / generate data
├── requirements.txt
└── .env                        # DATABASE_URL (Neon)
```

## Setup

```powershell
cd Backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy Neon URL into Backend/.env
# DATABASE_URL=postgresql://...@...neon.tech/...?sslmode=require

# Existing Prisma DB — just stamp:
alembic stamp 001_baseline

# Fresh DB:
alembic upgrade head

# Run API
uvicorn app.main:app --reload --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health + model status |
| POST | `/api/ml/predict` | Isolation Forest score |
| POST | `/api/ml/train` | Retrain from artifacts CSV |
| GET | `/api/ml/status` | Model metadata |
| GET | `/api/alerts` | List anomaly alerts |
| PATCH | `/api/alerts` | Resolve alert |
| GET | `/api/telemetry` | Fleet snapshot |
| POST | `/api/simulate` | Ingest telemetry + hybrid detect |
| GET | `/api/demand/status` | Artifact and serving-method status |
| GET | `/api/demand/projects` | Active/upcoming forecast projects |
| GET | `/api/demand/projects/{id}/equipment/{type}` | Four-week demand forecast |
| GET | `/api/demand/projects/{id}/packages` | Customer-first package comparison |
| GET | `/api/demand/dealer` | Regional demand, availability, and safe transfers |
| GET | `/api/demand/metrics` | Admin-only verification and promotion evidence |
| POST | `/api/demand/override` | Versioned, idempotent customer override |

Demand metrics are synthetic engineering evidence, not measured business
performance. See [`../docs/demand-forecasting.md`](../docs/demand-forecasting.md)
for the tournament, validation, reproduction commands, and production gate.

Swagger: http://localhost:8000/docs
