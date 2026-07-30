# Isolation Forest Phase (Hybrid Anomaly Detection)

This folder implements the **Isolation Forest** branch of the hybrid anomaly pipeline:

```
Feature Engineering
        │
   ┌────┴────┐
   ▼         ▼
 Rules    Isolation Forest  ← you are here
   │         │
   └────┬────┘
        ▼
 Hybrid Classifier → Alerts
```

## Files

| File | Role |
|------|------|
| `types.ts` | Feature names, model/config types |
| `feature-vector.ts` | Telemetry + deltas → numeric vector |
| `isolation-tree.ts` | Single isolation tree build + path length |
| `isolation-forest.ts` | Ensemble fit / score (Liu et al. 2008) |
| `model-store.ts` | Persist model to `models/isolation-forest.json` |
| `isolation-forest-detector.ts` | Live phase: warm-up → train → score |
| `index.ts` | Public exports |

## Lifecycle

1. On first packet, detector tries to load `models/isolation-forest.json`.
2. If missing, buffers ~200 live feature vectors (warm-up).
3. Fits 100 trees, saves model, then scores every subsequent packet.
4. Scores ≥ `contaminationThreshold` (default `0.62`) emit `STATISTICAL_OUTLIER`.

## Offline train API

```ts
import { IsolationForestDetector, buildFeatureVector } from './isolation-forest';

// After you assemble FeatureVector[]
IsolationForestDetector.train(vectors, { nTrees: 100, contaminationThreshold: 0.62 });
```

## Hybrid behaviour

- **Rules only** → alert `source=RULE`
- **IF only** → alert `STATISTICAL_OUTLIER`, `source=ISOLATION_FOREST`
- **Both** → rule severity elevated, tagged `HYBRID`
