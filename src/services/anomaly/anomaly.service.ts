import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { ValidatedTelemetry } from '../../schemas/telemetry.schema';
import { FeatureEngineeringLayer } from './feature-engineering';
import { RuleDetector } from './rule-detector';
import { IsolationForestDetector } from './isolation-forest';
import { HybridClassifier } from './hybrid-classifier';
import { DetectedAnomaly } from './types';

/**
 * AnomalyService
 * --------------
 * Hybrid anomaly detection pipeline (matches docs/anaomoly.txt):
 *
 *  1. Feature Engineering  — deltas + spatial features
 *  2. Parallel phases
 *       a. Rule-Based Detection   (10 deterministic rules)
 *       b. Isolation Forest       (statistical outlier scoring)
 *  3. Hybrid Classification — merge / elevate / tag sources
 *  4. Persist Alerts        — AnomalyAlert rows
 *  5. Structured logging
 */
export class AnomalyService {
  /**
   * Main entry point: hybrid detect + persist.
   * Non-blocking — errors here do NOT fail the parent ingestion transaction.
   */
  public static async detectAndRecord(telemetry: ValidatedTelemetry): Promise<void> {
    try {
      // ── Phase 1: Feature Engineering ──────────────────────────────────────
      const features = FeatureEngineeringLayer.compute(telemetry);

      // ── Phase 2: Parallel detection branches ──────────────────────────────
      const ruleFindings: DetectedAnomaly[] = RuleDetector.detect(telemetry, features);
      const ifFindings: DetectedAnomaly[] = IsolationForestDetector.detect(
        telemetry,
        features
      );

      // ── Phase 3: Hybrid Classification ────────────────────────────────────
      const violations = HybridClassifier.classify(ruleFindings, ifFindings);

      if (violations.length === 0) {
        return;
      }

      logger.warn(
        {
          equipmentId: telemetry.equipmentId,
          violationCount: violations.length,
          types: violations.map((v) => v.anomalyType),
          sources: violations.map((v) => v.detectionSource),
          ruleHits: ruleFindings.length,
          ifHits: ifFindings.length,
          ifReady: IsolationForestDetector.isReady(),
        },
        '🚨 Hybrid anomalies detected — persisting alerts'
      );

      // ── Phase 4: Persist each classified alert ────────────────────────────
      const alertInserts = violations.map((violation) =>
        prisma.anomalyAlert.create({
          data: {
            equipmentId: telemetry.equipmentId,
            equipmentType: telemetry.equipmentType,
            siteId: telemetry.siteId ?? null,
            operatorId: telemetry.operatorId ?? null,
            anomalyType: violation.anomalyType,
            severity: violation.severity,
            description: violation.description,
            recommendation: violation.recommendation,
            triggerValue: formatTriggerValue(violation),
            thresholdValue: violation.thresholdValue,
            isResolved: false,
          },
        })
      );

      await Promise.all(alertInserts);

      // ── Phase 5: Structured logs ──────────────────────────────────────────
      for (const v of violations) {
        logger.warn(
          {
            equipmentId: telemetry.equipmentId,
            anomalyType: v.anomalyType,
            severity: v.severity,
            detectionSource: v.detectionSource,
            anomalyScore: v.anomalyScore,
            triggerValue: v.triggerValue,
          },
          `[ANOMALY:${v.detectionSource}] ${v.description}`
        );
      }
    } catch (err: any) {
      logger.error(
        { err: err.message, equipmentId: telemetry.equipmentId },
        'AnomalyService: Failed to detect or persist anomaly alerts'
      );
    }
  }
}

/**
 * Encode detection source (+ optional IF score) into the triggerValue string
 * so the dashboard can display hybrid provenance without a schema migration
 * for a dedicated column.
 */
function formatTriggerValue(violation: DetectedAnomaly): string {
  const parts = [
    `source=${violation.detectionSource}`,
    violation.triggerValue,
  ];
  if (violation.anomalyScore !== undefined) {
    parts.push(`ifScore=${violation.anomalyScore.toFixed(3)}`);
  }
  return parts.join(' | ');
}
