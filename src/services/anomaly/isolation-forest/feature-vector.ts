import { ValidatedTelemetry } from '../../../schemas/telemetry.schema';
import { ComputedFeatures } from '../feature-engineering';
import { FEATURE_NAMES, FeatureVector } from './types';

/**
 * Builds a dense numeric feature vector for Isolation Forest scoring.
 * Features combine raw telemetry + engineered deltas so the model sees
 * both absolute operating state and short-term change patterns.
 */
export function buildFeatureVector(
  telemetry: ValidatedTelemetry,
  features: ComputedFeatures
): FeatureVector {
  const vector: FeatureVector = [
    telemetry.fuelLevel,
    telemetry.engineHours,
    telemetry.idleHours,
    telemetry.speed,
    telemetry.engineTemperature,
    telemetry.hydraulicPressure,
    telemetry.batteryVoltage,
    telemetry.loadPercentage,
    telemetry.vibrationLevel,
    features.fuelDelta,
    features.engineHoursDelta,
    features.idleHoursDelta,
    telemetry.engineStatus === 'ON' ? 1 : 0,
    features.distanceFromSiteCenter ?? 0,
  ];

  if (vector.length !== FEATURE_NAMES.length) {
    throw new Error(
      `Feature vector length mismatch: got ${vector.length}, expected ${FEATURE_NAMES.length}`
    );
  }

  return vector;
}

/**
 * Human-readable snapshot of the top contributors for logging / alerts.
 * Reports absolute magnitude of each feature (useful for trigger values).
 */
export function summarizeFeatureVector(vector: FeatureVector): string {
  const pairs = FEATURE_NAMES.map((name, i) => `${name}=${formatNum(vector[i])}`);
  return pairs.join(', ');
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return 'NaN';
  return Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3);
}
