import { AnomalyType, AnomalySeverity } from '@prisma/client';

/**
 * Which detector phase produced the finding.
 * HYBRID means both rule-based and Isolation Forest agreed.
 */
export type DetectionSource = 'RULE' | 'ISOLATION_FOREST' | 'HYBRID';

/**
 * Unified anomaly finding used by every phase (rules, IF, classification).
 */
export interface DetectedAnomaly {
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  recommendation: string;
  triggerValue: string;
  thresholdValue: string;
  /** Origin of the detection after hybrid classification */
  detectionSource: DetectionSource;
  /** Isolation Forest anomaly score in [0, 1]; higher = more anomalous */
  anomalyScore?: number;
}
