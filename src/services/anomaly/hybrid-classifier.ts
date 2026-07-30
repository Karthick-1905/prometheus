import { AnomalySeverity } from '@prisma/client';
import { DetectedAnomaly } from './types';

/**
 * HybridClassifier
 * ----------------
 * Merges Rule-Based and Isolation Forest findings into a single alert set.
 *
 * Strategy:
 *  1. Keep every rule-based violation (high precision, known failure modes).
 *  2. Keep Isolation Forest outliers that rules did not already cover
 *     (statistical novelty the thresholds miss).
 *  3. When BOTH phases fire on the same packet, elevate severity one notch
 *     for rule findings and tag them HYBRID (rules + IF agreement).
 */
export class HybridClassifier {
  public static classify(
    ruleFindings: DetectedAnomaly[],
    ifFindings: DetectedAnomaly[]
  ): DetectedAnomaly[] {
    const bothFired = ruleFindings.length > 0 && ifFindings.length > 0;
    const merged: DetectedAnomaly[] = [];

    // Rule findings — optionally upgraded when Isolation Forest agrees
    for (const finding of ruleFindings) {
      if (bothFired) {
        merged.push({
          ...finding,
          detectionSource: 'HYBRID',
          severity: elevateSeverity(finding.severity),
          description: `${finding.description} [Hybrid confirmed: Isolation Forest also flagged this packet]`,
          anomalyScore: ifFindings[0]?.anomalyScore,
        });
      } else {
        merged.push({
          ...finding,
          detectionSource: finding.detectionSource ?? 'RULE',
        });
      }
    }

    // IF-only findings — surface statistical outliers rules did not catch
    if (ifFindings.length > 0) {
      if (ruleFindings.length === 0) {
        for (const finding of ifFindings) {
          merged.push({
            ...finding,
            detectionSource: 'ISOLATION_FOREST',
          });
        }
      } else {
        // Rules already present: attach a single IF context alert only when
        // the IF score is strong enough to warrant a separate statistical note
        const strong = ifFindings.filter((f) => (f.anomalyScore ?? 0) >= 0.7);
        for (const finding of strong) {
          merged.push({
            ...finding,
            detectionSource: 'HYBRID',
            description: `${finding.description} [Co-detected with rule-based phase]`,
          });
        }
      }
    }

    return merged;
  }
}

function elevateSeverity(severity: AnomalySeverity): AnomalySeverity {
  if (severity === AnomalySeverity.INFO) return AnomalySeverity.WARNING;
  if (severity === AnomalySeverity.WARNING) return AnomalySeverity.CRITICAL;
  return AnomalySeverity.CRITICAL;
}
