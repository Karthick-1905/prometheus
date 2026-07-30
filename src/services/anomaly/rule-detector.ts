import { ValidatedTelemetry } from '../../schemas/telemetry.schema';
import { ComputedFeatures } from './feature-engineering';
import { AnomalyType, AnomalySeverity } from '@prisma/client';
import { DetectedAnomaly } from './types';

// Re-export shared type so existing imports from rule-detector keep working
export type { DetectedAnomaly } from './types';

// ─── Thresholds ──────────────────────────────────────────────────────────────

const THRESHOLDS = {
  ENGINE_TEMP_MAX: 105,           // °C
  VIBRATION_MAX: 15.0,            // mm/s
  VIBRATION_LOAD_MIN: 90,         // % load when checking vibration
  BATTERY_VOLTAGE_MIN: 11.0,      // V
  ENGINE_HOURS_DELTA_MAX: 1.0,    // hrs per 5-min step (tamper detection)
  IDLE_HOURS_DELTA_MAX: 1.0,      // hrs per 5-min step
  FUEL_DELTA_MAX: 10.0,           // % drop per 5-min step
  GEOFENCE_DISTANCE_MAX: 0.05,    // degrees (~5 km radius)
} as const;

// ─── Individual Rule Functions ────────────────────────────────────────────────

function checkUnassignedOperator(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.engineStatus === 'ON' && !t.operatorId) {
    return {
      anomalyType: AnomalyType.UNASSIGNED_OPERATOR,
      severity: AnomalySeverity.CRITICAL,
      description: `Engine is running on ${t.equipmentId} (${t.equipmentType}) with no operator assigned.`,
      recommendation: 'Immediately verify who is operating this machine. Check for unauthorized usage. Assign an operator or shut down the engine.',
      triggerValue: 'operatorId = NULL, engineStatus = ON',
      thresholdValue: 'operatorId must be set when engine is ON',
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkEngineOverheat(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.engineTemperature > THRESHOLDS.ENGINE_TEMP_MAX) {
    return {
      anomalyType: AnomalyType.ENGINE_OVERHEAT,
      severity: AnomalySeverity.CRITICAL,
      description: `Engine temperature on ${t.equipmentId} is critically high at ${t.engineTemperature}°C.`,
      recommendation: 'Shut down the machine immediately. Inspect coolant levels, radiator, and cooling fan. Do not restart until temperature drops below 90°C.',
      triggerValue: `${t.engineTemperature}°C`,
      thresholdValue: `> ${THRESHOLDS.ENGINE_TEMP_MAX}°C`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkSevereVibration(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.vibrationLevel > THRESHOLDS.VIBRATION_MAX && t.loadPercentage >= THRESHOLDS.VIBRATION_LOAD_MIN) {
    return {
      anomalyType: AnomalyType.SEVERE_VIBRATION,
      severity: AnomalySeverity.CRITICAL,
      description: `Severe vibration detected on ${t.equipmentId}: ${t.vibrationLevel.toFixed(2)} mm/s at ${t.loadPercentage}% load.`,
      recommendation: 'Reduce load immediately. Inspect hydraulic system, engine mounts, and undercarriage. Schedule preventive maintenance.',
      triggerValue: `vibration=${t.vibrationLevel.toFixed(2)} mm/s, load=${t.loadPercentage}%`,
      thresholdValue: `vibration > ${THRESHOLDS.VIBRATION_MAX} mm/s AND load >= ${THRESHOLDS.VIBRATION_LOAD_MIN}%`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkExpiredRental(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.rentalStatus === 'Overdue') {
    return {
      anomalyType: AnomalyType.EXPIRED_RENTAL,
      severity: AnomalySeverity.WARNING,
      description: `${t.equipmentId} (${t.equipmentType}) is operating beyond its rental contract end date. Status: Overdue.`,
      recommendation: 'Contact the site manager to arrange immediate return or contract extension. Issue a formal overdue notice to the company.',
      triggerValue: `rentalStatus = Overdue`,
      thresholdValue: 'rentalStatus must not be Overdue',
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkMissingGps(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.engineStatus === 'ON' && (t.latitude == null || t.longitude == null)) {
    return {
      anomalyType: AnomalyType.MISSING_GPS,
      severity: AnomalySeverity.WARNING,
      description: `GPS signal lost for ${t.equipmentId} while engine is running. Cannot track location.`,
      recommendation: 'Check GPS antenna and wiring. Verify the telematics unit is functioning correctly. Dispatch field technician if GPS remains offline.',
      triggerValue: 'latitude/longitude = NULL, engineStatus = ON',
      thresholdValue: 'GPS coordinates must be present when engine is ON',
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkLowBattery(t: ValidatedTelemetry): DetectedAnomaly | null {
  if (t.batteryVoltage < THRESHOLDS.BATTERY_VOLTAGE_MIN) {
    return {
      anomalyType: AnomalyType.LOW_BATTERY,
      severity: AnomalySeverity.WARNING,
      description: `Battery voltage on ${t.equipmentId} is critically low at ${t.batteryVoltage}V.`,
      recommendation: 'Inspect the alternator, battery terminals, and charging system. Replace battery if voltage remains low after engine run-up.',
      triggerValue: `${t.batteryVoltage}V`,
      thresholdValue: `< ${THRESHOLDS.BATTERY_VOLTAGE_MIN}V`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkEngineHoursTamper(
  t: ValidatedTelemetry,
  f: ComputedFeatures
): DetectedAnomaly | null {
  if (f.engineHoursDelta > THRESHOLDS.ENGINE_HOURS_DELTA_MAX) {
    return {
      anomalyType: AnomalyType.ENGINE_HOURS_TAMPER,
      severity: AnomalySeverity.WARNING,
      description: `Suspicious engine hour jump on ${t.equipmentId}: +${f.engineHoursDelta.toFixed(2)} hrs in a single 5-minute step. Possible odometer tampering.`,
      recommendation: 'Audit the telematics device for tampering. Cross-check with physical meter reading. Escalate to maintenance supervisor.',
      triggerValue: `delta = +${f.engineHoursDelta.toFixed(2)} hrs`,
      thresholdValue: `> ${THRESHOLDS.ENGINE_HOURS_DELTA_MAX} hr per 5-min step`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkExcessiveIdle(
  t: ValidatedTelemetry,
  f: ComputedFeatures
): DetectedAnomaly | null {
  if (f.idleHoursDelta > THRESHOLDS.IDLE_HOURS_DELTA_MAX) {
    return {
      anomalyType: AnomalyType.EXCESSIVE_IDLE,
      severity: AnomalySeverity.INFO,
      description: `${t.equipmentId} (${t.equipmentType}) has been idling for an unusually long period: +${f.idleHoursDelta.toFixed(2)} hrs this step.`,
      recommendation: 'Remind the operator to shut down the engine during extended breaks. Review shift schedule and site productivity metrics.',
      triggerValue: `idleDelta = +${f.idleHoursDelta.toFixed(2)} hrs`,
      thresholdValue: `> ${THRESHOLDS.IDLE_HOURS_DELTA_MAX} hr per 5-min step`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkFuelLeakOrTheft(
  t: ValidatedTelemetry,
  f: ComputedFeatures
): DetectedAnomaly | null {
  if (f.fuelDelta > THRESHOLDS.FUEL_DELTA_MAX) {
    return {
      anomalyType: AnomalyType.FUEL_LEAK_THEFT,
      severity: AnomalySeverity.CRITICAL,
      description: `Abnormal fuel drop on ${t.equipmentId}: -${f.fuelDelta.toFixed(1)}% in 5 minutes. Suspected fuel leak or theft.`,
      recommendation: 'Immediately inspect fuel tank, lines, and seals. Check for unauthorized fuel removal. Lock fuel cap and file a report if theft is suspected.',
      triggerValue: `fuelDrop = -${f.fuelDelta.toFixed(1)}%`,
      thresholdValue: `> ${THRESHOLDS.FUEL_DELTA_MAX}% drop per 5-min step`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

function checkGeofenceViolation(
  t: ValidatedTelemetry,
  f: ComputedFeatures
): DetectedAnomaly | null {
  if (f.distanceFromSiteCenter !== null && f.distanceFromSiteCenter > THRESHOLDS.GEOFENCE_DISTANCE_MAX) {
    return {
      anomalyType: AnomalyType.GEOFENCE_VIOLATION,
      severity: AnomalySeverity.WARNING,
      description: `${t.equipmentId} has moved outside its authorized geofence. Distance from site ${t.siteId}: ${f.distanceFromSiteCenter.toFixed(4)}°.`,
      recommendation: 'Contact the site operator immediately. Verify whether the machine was relocated with authorization. If unauthorized, initiate recovery procedure.',
      triggerValue: `distance = ${f.distanceFromSiteCenter.toFixed(4)}°`,
      thresholdValue: `> ${THRESHOLDS.GEOFENCE_DISTANCE_MAX}° from site center`,
      detectionSource: 'RULE',
    };
  }
  return null;
}

// ─── Rule Detector ────────────────────────────────────────────────────────────

/**
 * RuleDetector
 * ------------
 * Executes all 10 deterministic rule checks against a validated telemetry packet
 * and its computed feature set. Returns every triggered anomaly.
 */
export class RuleDetector {
  public static detect(
    telemetry: ValidatedTelemetry,
    features: ComputedFeatures
  ): DetectedAnomaly[] {
    const violations: DetectedAnomaly[] = [];

    const checks = [
      checkUnassignedOperator(telemetry),
      checkEngineOverheat(telemetry),
      checkSevereVibration(telemetry),
      checkExpiredRental(telemetry),
      checkMissingGps(telemetry),
      checkLowBattery(telemetry),
      checkEngineHoursTamper(telemetry, features),
      checkExcessiveIdle(telemetry, features),
      checkFuelLeakOrTheft(telemetry, features),
      checkGeofenceViolation(telemetry, features),
    ];

    for (const result of checks) {
      if (result !== null) {
        violations.push(result);
      }
    }

    return violations;
  }
}
