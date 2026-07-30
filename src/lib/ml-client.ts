/**
 * src/lib/ml-client.ts
 * --------------------
 * HTTP client for the Python Isolation Forest ML server (FastAPI on port 8000).
 * Used by AnomalyService to get statistical outlier scores in real-time.
 *
 * If the ML server is unavailable, all calls return a graceful fallback
 * (isAnomaly=false) so the rule-based pipeline continues uninterrupted.
 */
import { logger } from './logger';

const ML_SERVER_URL = process.env.ML_SERVER_URL ?? 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 3000; // 3 s — must not block ingestion

// ── Types (mirrors python-ml/schemas/telemetry.py) ───────────────────────────

export interface MLFeatureVector {
  engineHoursPerDay:      number;
  idleHoursPerDay:        number;
  rentalDays:             number;
  hasOperator:            number;
  hasSite:                number;
  idleRatio:              number;
  equipmentId?:           string;
  equipmentType?:         string;
}

export interface MLPredictResult {
  equipmentId?:   string;
  isAnomaly:      boolean;
  anomalyScore:   number;   // [0, 1] — higher = more anomalous
  confidence:     string;   // LOW | MEDIUM | HIGH
  message:        string;
}

export interface MLHealthResult {
  status:       string;
  model_loaded: boolean;
  model_meta:   Record<string, unknown> | null;
}

// ── Singleton health state ────────────────────────────────────────────────────

let _mlServerAvailable: boolean | null = null; // null = not yet checked

async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${ML_SERVER_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data: MLHealthResult = await res.json();
    _mlServerAvailable = res.ok && data.status === 'ok';

    if (_mlServerAvailable && !data.model_loaded) {
      logger.warn({ url: ML_SERVER_URL }, 'ML server reachable but model not yet trained');
    }

    return _mlServerAvailable;
  } catch {
    _mlServerAvailable = false;
    return false;
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

/**
 * MLClient
 * --------
 * Thin HTTP wrapper around the Python FastAPI ML server.
 * All public methods are safe to call concurrently and will never throw.
 */
export class MLClient {
  /**
   * Score a feature vector via POST /predict.
   * Returns null gracefully when the ML server is down.
   */
  public static async predict(
    vector: MLFeatureVector
  ): Promise<MLPredictResult | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(`${ML_SERVER_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vector),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        logger.warn(
          { status: res.status, equipmentId: vector.equipmentId, body: err },
          'ML server /predict returned error'
        );
        return null;
      }

      return (await res.json()) as MLPredictResult;
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Only log first failure (avoid log spam when server is just not running)
        if (_mlServerAvailable !== false) {
          logger.warn(
            { err: err.message, url: ML_SERVER_URL },
            'ML server unreachable — Isolation Forest phase disabled for this session'
          );
          _mlServerAvailable = false;
        }
      }
      return null;
    }
  }

  /**
   * Returns true if the ML server is reachable and has a model loaded.
   * Result is cached after the first successful check.
   */
  public static async isAvailable(): Promise<boolean> {
    if (_mlServerAvailable === null) {
      return await checkHealth();
    }
    return _mlServerAvailable;
  }

  /**
   * Re-check server health (call after starting Python server).
   */
  public static async refreshAvailability(): Promise<boolean> {
    _mlServerAvailable = null;
    return await checkHealth();
  }
}
