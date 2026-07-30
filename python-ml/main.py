"""
main.py
-------
CAT Fleet Anomaly Detection — Python ML Server
FastAPI application for Isolation Forest inference and training.

Startup:
    uvicorn main:app --reload --port 8000

Or via the helper script:
    python main.py
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from model import predictor
from routes import health, predict, train


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Auto-load the model from disk on server startup."""
    loaded = predictor.load_model()
    if not loaded:
        print(
            "WARNING: No trained model found in annomoly/.\n"
            "   POST /train to train the model from annomoly/training-data.csv\n"
            "   or run: npm run seed:data && npm run train:forest"
        )
    yield
    # Shutdown — nothing to clean up
    print("ML Server shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="CAT Fleet — Isolation Forest ML API",
    description=(
        "Real-time anomaly scoring for Caterpillar equipment telemetry.\n\n"
        "**Pipeline**:\n"
        "1. Ingestion service sends a 14-dim feature vector via `POST /predict`\n"
        "2. ML server maps features → model space → scores with `IsolationForest`\n"
        "3. Returns anomaly flag, score [0–1], and confidence label\n\n"
        "**Train a new model**: `POST /train` (reads `annomoly/training-data.csv`)\n\n"
        "**Source**: `d:/STUDY/cat/python-ml/`"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the Next.js dev server (localhost:3000) and the ingestion service to call
# this API without browser CORS issues.

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(health.router)
app.include_router(predict.router)
app.include_router(train.router)


# ── Root ──────────────────────────────────────────────────────────────────────

@app.get("/", tags=["System"])
def root():
    return {
        "service":    "CAT Fleet ML Server",
        "version":    "1.0.0",
        "endpoints": {
            "health":       "GET  /health",
            "predict":      "POST /predict",
            "train":        "POST /train",
            "model_status": "GET  /model/status",
            "docs":         "GET  /docs",
        },
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
