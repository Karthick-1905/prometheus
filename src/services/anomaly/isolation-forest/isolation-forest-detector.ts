import { AnomalyType, AnomalySeverity } from '@prisma/client';
import { ValidatedTelemetry } from '../../../schemas/telemetry.schema';
import { ComputedFeatures } from '../feature-engineering';
import { DetectedAnomaly } from '../types';
import { IsolationForest } from './isolation-forest';
import { buildFeatureVector, summarizeFeatureVector } from './feature-vector';
import { ModelStore } from './model-store';
import {
  DEFAULT_IF_CONFIG,
  FeatureVector,
  IsolationForestConfig,
} from './types';
import { logger } from '../../../lib/logger';

/**
 * Minimum live samples collected before the forest is warm-started online.
 * Once trained (or loaded from disk), scoring runs on every packet.
 */
const WARMUP_SAMPLE_TARGET = 200;

/**
 * IsolationForestDetector
 * -----------------------
 * Phase 2 of the hybrid anomaly pipeline (alongside RuleDetector).
 *
 * Lifecycle:
 *  1. Try load a persisted model from models/isolation-forest.json
 *  2. If missing, buffer live feature vectors until WARMUP_SAMPLE_TARGET
 *  3. Fit forest, persist model, then score subsequent packets
 *  4. Emit DetectedAnomaly with detectionSource = ISOLATION_FOREST
 */
export class IsolationForestDetector {
  private static forest = new IsolationForest();
  private static store = new ModelStore();
  private static warmupBuffer: FeatureVector[] = [];
  private static ready = false;
  private static initialized = false;

  /**
   * One-time setup: load model from disk if present.
   */
  public static initialize(config: Partial<IsolationForestConfig> = {}): void {
    if (this.initialized) return;
    this.initialized = true;

    this.forest = new IsolationForest({ ...DEFAULT_IF_CONFIG, ...config });

    const existing = this.store.load();
    if (existing) {
      this.forest.load(existing);
      this.ready = true;
      logger.info(
        {
          nTrees: existing.trees.length,
          threshold: existing.config.contaminationThreshold,
        },
        'Isolation Forest phase ready (loaded persisted model)'
      );
    } else {
      logger.info(
        { warmupTarget: WARMUP_SAMPLE_TARGET },
        'Isolation Forest phase warming up — collecting live samples before first fit'
      );
    }
  }

  public static isReady(): boolean {
    return this.ready;
  }

  public static getWarmupProgress(): { current: number; target: number } {
    return {
      current: this.warmupBuffer.length,
      target: WARMUP_SAMPLE_TARGET,
    };
  }

  /**
   * Score one telemetry packet. Returns 0 or 1 statistical anomaly findings.
   * During warmup, returns [] and accumulates training samples.
   */
  public static detect(
    telemetry: ValidatedTelemetry,
    features: ComputedFeatures
  ): DetectedAnomaly[] {
    this.initialize();

    const vector = buildFeatureVector(telemetry, features);

    // Warm-up / online training path
    if (!this.ready) {
      this.warmupBuffer.push(vector);

      if (this.warmupBuffer.length >= WARMUP_SAMPLE_TARGET) {
        this.fitFromWarmup();
      } else if (this.warmupBuffer.length % 50 === 0) {
        logger.info(
          {
            collected: this.warmupBuffer.length,
            target: WARMUP_SAMPLE_TARGET,
          },
          'Isolation Forest warm-up progress'
        );
      }
      return [];
    }

    // Scoring path
    try {
      const result = this.forest.score(vector);
      if (!result.isAnomaly) {
        return [];
      }

      const severity = scoreToSeverity(result.score);
      const featureSnap = summarizeFeatureVector(vector);

      return [
        {
          anomalyType: AnomalyType.STATISTICAL_OUTLIER,
          severity,
          description:
            `Isolation Forest flagged ${telemetry.equipmentId} (${telemetry.equipmentType}) ` +
            `as a statistical outlier (score=${result.score.toFixed(3)}). ` +
            `Usage pattern deviates from the learned normal operating envelope.`,
          recommendation:
            'Review recent operating conditions for this asset. Compare against site norms. ' +
            'If rules did not also fire, treat as a soft alert and investigate gradual misuse, ' +
            'sensor drift, or emerging equipment failure.',
          triggerValue: `IF_score=${result.score.toFixed(3)}, pathLen=${result.meanPathLength.toFixed(2)}`,
          thresholdValue: `score >= ${this.forest.getModel()?.config.contaminationThreshold ?? DEFAULT_IF_CONFIG.contaminationThreshold}`,
          detectionSource: 'ISOLATION_FOREST',
          anomalyScore: result.score,
        },
      ];
    } catch (err: any) {
      logger.error(
        { err: err.message, equipmentId: telemetry.equipmentId },
        'IsolationForestDetector.score failed'
      );
      return [];
    }
  }

  /**
   * Explicit offline train from a matrix of feature vectors (e.g. CSV export).
   * Replaces the in-memory model and persists it.
   */
  public static train(data: FeatureVector[], config: Partial<IsolationForestConfig> = {}): void {
    this.forest = new IsolationForest({ ...DEFAULT_IF_CONFIG, ...config });
    const result = this.forest.fit(data);
    this.store.save(result.model);
    this.ready = true;
    this.warmupBuffer = [];
    this.initialized = true;

    logger.info(
      {
        nSamples: result.nSamples,
        nTrees: result.nTrees,
        path: this.store.getPath(),
      },
      'Isolation Forest trained offline and saved'
    );
  }

  /**
   * Reset detector state (tests / retrain).
   */
  public static reset(): void {
    this.forest = new IsolationForest();
    this.warmupBuffer = [];
    this.ready = false;
    this.initialized = false;
  }

  private static fitFromWarmup(): void {
    try {
      const result = this.forest.fit(this.warmupBuffer);
      this.store.save(result.model);
      this.ready = true;
      this.warmupBuffer = [];

      logger.info(
        {
          nSamples: result.nSamples,
          nTrees: result.nTrees,
          threshold: result.model.config.contaminationThreshold,
        },
        'Isolation Forest warm-up complete — hybrid phase fully active'
      );
    } catch (err: any) {
      logger.error({ err: err.message }, 'Isolation Forest warm-up fit failed');
    }
  }
}

function scoreToSeverity(score: number): AnomalySeverity {
  if (score >= 0.75) return AnomalySeverity.CRITICAL;
  if (score >= 0.65) return AnomalySeverity.WARNING;
  return AnomalySeverity.INFO;
}
