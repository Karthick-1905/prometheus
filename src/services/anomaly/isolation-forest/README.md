# TypeScript Isolation Forest (legacy reference)

> **Not used in production.** Live scoring goes through the **Python ML server**
> (`python-ml/`) via `src/lib/ml-client.ts` → `POST /predict`.

This folder keeps a pure-TypeScript Isolation Forest implementation for
education / offline experiments only.

| Use | Path |
|-----|------|
| **Production IF** | `python-ml/` + `annomoly/*.joblib` |
| Hybrid orchestration | `src/services/anomaly/anomaly.service.ts` |
| Rule phase | `src/services/anomaly/rule-detector.ts` |

To train the real model:

```bash
npm run ml:train
npm run ml:server
```
