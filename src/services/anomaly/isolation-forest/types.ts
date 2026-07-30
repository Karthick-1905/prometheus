/**
 * Isolation Forest module types
 * -----------------------------
 * Numeric feature space used for unsupervised outlier scoring.
 */

/** Ordered feature names — index aligns with FeatureVector values. */
export const FEATURE_NAMES = [
  'fuelLevel',
  'engineHours',
  'idleHours',
  'speed',
  'engineTemperature',
  'hydraulicPressure',
  'batteryVoltage',
  'loadPercentage',
  'vibrationLevel',
  'fuelDelta',
  'engineHoursDelta',
  'idleHoursDelta',
  'engineOn',
  'distanceFromSiteCenter',
] as const;

export type FeatureName = (typeof FEATURE_NAMES)[number];

/** Dense numeric vector (length === FEATURE_NAMES.length). */
export type FeatureVector = number[];

export interface IsolationForestConfig {
  /** Number of isolation trees */
  nTrees: number;
  /** Subsample size per tree */
  sampleSize: number;
  /** Max tree height; defaults to ceil(log2(sampleSize)) */
  maxDepth?: number;
  /**
   * Score threshold above which a point is flagged anomalous.
   * Typical range for IF anomaly scores is ~0.5–0.7 for outliers.
   */
  contaminationThreshold: number;
  /** Random seed for reproducible trees */
  seed: number;
}

export const DEFAULT_IF_CONFIG: IsolationForestConfig = {
  nTrees: 100,
  sampleSize: 256,
  contaminationThreshold: 0.62,
  seed: 42,
};

export interface IsolationForestModel {
  version: number;
  trainedAt: string;
  config: IsolationForestConfig;
  /** Serialized trees — each node is null (external) or split node */
  trees: IsolationTreeNode[];
  /** Running count of samples used during fit */
  nSamples: number;
  featureCount: number;
}

export type IsolationTreeNode =
  | null
  | {
      /** Feature index used for this split */
      featureIndex: number;
      /** Split threshold */
      splitValue: number;
      /** Current depth when this external leaf was created (size of partition) */
      size: number;
      left: IsolationTreeNode;
      right: IsolationTreeNode;
    };

export interface IsolationForestScore {
  /** Anomaly score in [0, 1]; higher = more isolated / anomalous */
  score: number;
  /** True when score >= contaminationThreshold */
  isAnomaly: boolean;
  /** Mean path length across trees (lower = more anomalous) */
  meanPathLength: number;
}

export interface IsolationForestTrainResult {
  model: IsolationForestModel;
  nSamples: number;
  nTrees: number;
}
