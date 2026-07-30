/**
 * src/services/anomaly/anomaly.service.ts
 * ----------------------------------------
 * Hybrid anomaly detection pipeline:
 *
 *  Phase 1 — Feature Engineering   (TypeScript, in-process)
 *  Phase 2a — Rule-Based Detection (TypeScript, 10 deterministic rules)
 *  Phase 2b — Isolation Forest     (Python FastAPI, ML server at ML_SERVER_URL)
 *  Phase 3  — Hybrid Classification (merge + severity elevation)
 *  Phase 4  — Persist AnomalyAlerts to Neon DB
 *  Phase 5  — Structured logging
 */
import { AnomalyType, AnomalySeverity } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { MLClient, MLFeatureVector } from '../../lib/ml-client';
import { ValidatedTelemetry } from '../../schemas/telemetry.schema';
import { FeatureEngineeringLayer } from './feature-engineering';
import { RuleDetector } from './rule-detector';
import { HybridClassifier } from './hybrid-classifier';
import { DetectedAnomaly } from './types';

export class AnomalyService {
  /**
   * Main entry point: hybrid detect + persist.
   * Non-blocking — errors here do NOT fail the parent ingestion transaction.
   */
  public static async detectAndRecord(telemetry: ValidatedTelemetry): Promise<void> {
    try {
      // ── Phase 1: Feature Engineering ──────────────────────────────────────
      const features = FeatureEngineeringLayer.compute(telemetry);

      // ── Phase 2a: Rule-Based Detection (always runs) ──────────────────────
      const ruleFindings: DetectedAnomaly[] = RuleDetector.detect(telemetry, features);

      // ── Phase 2b: Isolation Forest via Python ML Server (optional) ────────
      const ifFindings: DetectedAnomaly[] = [];

      const eqId = parseInt(telemetry.equipmentId) || 1;
      const activeContract = await prisma.rentalContract.findFirst({
        where: {
          equipmentId: eqId,
          rentalStatus: 'ACTIVE',
        },
        orderBy: {
          rentalStart: 'desc',
        },
      });

      let rentalDays = 15;
      let daysElapsed = 1;

      if (activeContract) {
        const start = activeContract.rentalStart ? new Date(activeContract.rentalStart) : new Date();
        const end = activeContract.expectedReturn ? new Date(activeContract.expectedReturn) : null;
        if (end) {
          rentalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        }
        const now = new Date(telemetry.timestamp);
        daysElapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      }

      const engineHoursPerDay = telemetry.engineHours / daysElapsed;
      const idleHoursPerDay = telemetry.idleHours / daysElapsed;
      const totalHours = engineHoursPerDay + idleHoursPerDay;
      const idleRatio = totalHours > 0 ? (idleHoursPerDay / totalHours) : 0;

      const mlVector: MLFeatureVector = {
        engineHoursPerDay,
        idleHoursPerDay,
        rentalDays,
        hasOperator: telemetry.operatorId ? 1 : 0,
        hasSite: telemetry.siteId ? 1 : 0,
        idleRatio,
        equipmentId: telemetry.equipmentId,
        equipmentType: telemetry.equipmentType,
      };

      const mlResult = await MLClient.predict(mlVector);

      if (mlResult?.isAnomaly) {
        const severity = scoreToSeverity(mlResult.anomalyScore);
        ifFindings.push({
          anomalyType: AnomalyType.STATISTICAL_OUTLIER,
          severity,
          description:
            `Isolation Forest flagged ${telemetry.equipmentId} (${telemetry.equipmentType}) ` +
            `as a statistical outlier (score=${mlResult.anomalyScore.toFixed(3)}, confidence=${mlResult.confidence}). ` +
            `Usage pattern deviates from the learned normal operating envelope.`,
          recommendation:
            'Review recent operating conditions for this asset. Compare against site norms. ' +
            'If no rule-based alerts also fired, treat as a soft alert and investigate gradual misuse, ' +
            'sensor drift, or emerging equipment failure.',
          triggerValue: `IF_score=${mlResult.anomalyScore.toFixed(3)}`,
          thresholdValue: `IsolationForest decision_function < tuned threshold`,
          detectionSource: 'ISOLATION_FOREST',
          anomalyScore: mlResult.anomalyScore,
        });
      }

      // ── Phase 3: Hybrid Classification ────────────────────────────────────
      const violations = HybridClassifier.classify(ruleFindings, ifFindings);

      if (violations.length === 0) return;

      logger.warn(
        {
          equipmentId:    telemetry.equipmentId,
          violationCount: violations.length,
          types:          violations.map((v) => v.anomalyType),
          sources:        violations.map((v) => v.detectionSource),
          ruleHits:       ruleFindings.length,
          ifHits:         ifFindings.length,
          mlServerUsed:   mlResult !== null,
        },
        '🚨 Hybrid anomalies detected — persisting alerts'
      );

      // ── Phase 4: Persist each classified alert ────────────────────────────
      const alertInserts = violations.map((v) =>
        prisma.anomalyAlert.create({
          data: {
            equipmentId:    telemetry.equipmentId,
            equipmentType:  telemetry.equipmentType,
            siteId:         telemetry.siteId ?? null,
            operatorId:     telemetry.operatorId ?? null,
            anomalyType:    v.anomalyType,
            severity:       v.severity,
            description:    v.description,
            recommendation: v.recommendation,
            triggerValue:   formatTriggerValue(v),
            thresholdValue: v.thresholdValue,
            isResolved:     false,
          },
        })
      );
      await Promise.all(alertInserts);

      // ── Phase 5: Structured logs ──────────────────────────────────────────
      for (const v of violations) {
        logger.warn(
          {
            equipmentId:     telemetry.equipmentId,
            anomalyType:     v.anomalyType,
            severity:        v.severity,
            detectionSource: v.detectionSource,
            anomalyScore:    v.anomalyScore,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreToSeverity(score: number): AnomalySeverity {
  if (score >= 0.75) return AnomalySeverity.CRITICAL;
  if (score >= 0.65) return AnomalySeverity.WARNING;
  return AnomalySeverity.INFO;
}

function formatTriggerValue(v: DetectedAnomaly): string {
  const parts = [`source=${v.detectionSource}`, v.triggerValue];
  if (v.anomalyScore !== undefined) {
    parts.push(`ifScore=${v.anomalyScore.toFixed(3)}`);
  }
  return parts.join(' | ');
}
