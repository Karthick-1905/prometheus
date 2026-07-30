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
│       ├── demand_forecasting/ # scaffold
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
| GET | `/api/demand/status` | Demand forecasting scaffold |

Swagger: http://localhost:8000/docs
