# CAT Fleet — Python ML Server (`python-ml/`)

FastAPI microservice that provides real-time **Isolation Forest** anomaly
scoring for the Caterpillar Fleet Rental Tracking System.

## Architecture

```
MQTT Broker
     │
     ▼
TypeScript Ingestion Service  (src/index.ts)
     │  Phase 1: Rule-Based Detection  (10 rules, in-process)
     │  Phase 2: HTTP POST /predict ──────────────────────┐
     │                                                     ▼
     │                                        Python FastAPI ML Server
     │                                         POST /predict
     │                                         → IsolationForest.score()
     │                                         → { isAnomaly, score, confidence }
     │  Phase 3: Hybrid Classification  ◄──────────────────┘
     ▼
Neon PostgreSQL  (AnomalyAlert table)
     │
     ▼
Next.js Dashboard  (localhost:3000)
```

## Endpoints

| Method | Path           | Description                                 |
|--------|---------------|---------------------------------------------|
| GET    | `/`           | Service info                                |
| GET    | `/health`     | Health + model load status                  |
| POST   | `/predict`    | Score a 14-dim feature vector               |
| POST   | `/train`      | Train from `annomoly/training-data.csv`     |
| GET    | `/model/status` | Trained model metadata                    |
| GET    | `/docs`       | Swagger UI                                  |
| GET    | `/redoc`      | ReDoc UI                                    |

## Setup

```bash
# 1. Create a virtual environment
cd python-ml
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Generate training data (run from project root)
cd ..
npm run seed:data              # generates annomoly/training-data.csv

# 4. Train the model
cd python-ml
python main.py &               # start server first

# Or train via API:
curl -X POST http://localhost:8000/train

# 5. Start the ML server
python main.py
# → http://localhost:8000
# → Swagger: http://localhost:8000/docs
```

## Feature Vector (14 dimensions)

The `/predict` endpoint expects a JSON body matching the TypeScript
`buildFeatureVector()` output from `src/services/anomaly/isolation-forest/feature-vector.ts`:

```json
{
  "fuelLevel":              75.3,
  "engineHours":            1243.5,
  "idleHours":              42.1,
  "speed":                  12.4,
  "engineTemperature":      88.0,
  "hydraulicPressure":      165.0,
  "batteryVoltage":         13.8,
  "loadPercentage":         62.0,
  "vibrationLevel":         2.1,
  "fuelDelta":              0.5,
  "engineHoursDelta":       0.08,
  "idleHoursDelta":         0.01,
  "engineOn":               1,
  "distanceFromSiteCenter": 0.003,
  "equipmentId":            "CAT-EX-1001",
  "equipmentType":          "Excavator"
}
```

Response:
```json
{
  "equipmentId":  "CAT-EX-1001",
  "isAnomaly":    false,
  "anomalyScore": 0.31,
  "confidence":   "LOW",
  "message":      "Normal operating pattern (score=0.310)."
}
```

## Model Details

- **Algorithm**: `sklearn.ensemble.IsolationForest` (**Python**, not TypeScript)
- **Training data**: 15k labeled telemetry-style rows (`annomoly/training-data.csv`)
- **Feature space**: **14-dim live vector** (same as TypeScript `buildFeatureVector`)
- **Training mode**: fit on normal-only samples (novelty detection) + F1-tuned threshold
- **Saved model**: `annomoly/isolation_forest.joblib`
- **Saved scaler**: `annomoly/scaler.joblib`
- **Metadata**: `annomoly/model_meta.json` (threshold, metrics, feature list)

### Generate + train

```bash
# from repo root
npm run ml:train
# or:
cd python-ml
python train_and_eval.py --n 15000
```

## Anomaly Score Interpretation

| Score Range | Label     | Severity Mapping |
|-------------|-----------|-----------------|
| ≥ 0.75      | HIGH      | CRITICAL         |
| 0.65–0.74   | MEDIUM    | WARNING          |
| < 0.65      | LOW       | INFO             |
