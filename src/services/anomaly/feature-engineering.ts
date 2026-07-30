import { ValidatedTelemetry } from '../../schemas/telemetry.schema';

/**
 * Computed feature set derived from a single telemetry packet,
 * enriched with per-equipment rolling state for delta calculations.
 */
export interface ComputedFeatures {
  fuelDelta: number;           // % drop in fuel since last reading
  engineHoursDelta: number;    // Engine hours gained in this step
  idleHoursDelta: number;      // Idle hours gained in this step
  distanceFromSiteCenter: number | null; // GPS degrees from site center (null if no site)
}

/**
 * Rolling state map: keeps previous telemetry readings per equipment.
 * Lives in-memory for the duration of the ingestion service process.
 */
interface EquipmentState {
  lastFuelLevel: number;
  lastEngineHours: number;
  lastIdleHours: number;
}

const equipmentStateMap = new Map<string, EquipmentState>();

/**
 * Known site center coordinates — derived from pipeline/publish_telemetry.js site list.
 * In a production system this would be read from the ProjectSite table.
 * We use a simple approximation: if the telemetry carries a siteId we compare
 * GPS distance against a 0.05-degree radius threshold.
 *
 * Since siteId values like "S101" don't map to fixed coordinates here, we compute
 * distanceFromSiteCenter only when we have enough context from prior readings.
 */

/**
 * Euclidean GPS distance approximation in degrees.
 * Accurate enough for a ~5km radius threshold check.
 */
function gpsDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat1 - lat2;
  const dLon = lon1 - lon2;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

/**
 * Per-site anchor coordinates, populated progressively as the first packet
 * per siteId is observed. Acts as a lightweight site-center cache.
 */
const siteCenterMap = new Map<string, { lat: number; lng: number }>();

/**
 * FeatureEngineeringLayer
 * -----------------------
 * Computes delta-based and spatial features from a raw validated telemetry packet.
 * Updates the rolling equipment state map on each call.
 */
export class FeatureEngineeringLayer {
  /**
   * Compute derived features for a single telemetry packet.
   */
  public static compute(telemetry: ValidatedTelemetry): ComputedFeatures {
    const id = telemetry.equipmentId;
    const prev = equipmentStateMap.get(id);

    // --- Delta calculations ---
    const fuelDelta = prev ? Math.max(0, prev.lastFuelLevel - telemetry.fuelLevel) : 0;
    const engineHoursDelta = prev ? Math.max(0, telemetry.engineHours - prev.lastEngineHours) : 0;
    const idleHoursDelta = prev ? Math.max(0, telemetry.idleHours - prev.lastIdleHours) : 0;

    // --- Spatial features ---
    let distanceFromSiteCenter: number | null = null;

    if (telemetry.siteId && telemetry.latitude != null && telemetry.longitude != null) {
      const siteId = telemetry.siteId;

      if (!siteCenterMap.has(siteId)) {
        // First time we see this siteId — anchor it to the current coordinates
        siteCenterMap.set(siteId, {
          lat: telemetry.latitude,
          lng: telemetry.longitude,
        });
      }

      const center = siteCenterMap.get(siteId)!;
      distanceFromSiteCenter = gpsDistance(
        telemetry.latitude,
        telemetry.longitude,
        center.lat,
        center.lng
      );
    }

    // --- Update rolling state ---
    equipmentStateMap.set(id, {
      lastFuelLevel: telemetry.fuelLevel,
      lastEngineHours: telemetry.engineHours,
      lastIdleHours: telemetry.idleHours,
    });

    return {
      fuelDelta,
      engineHoursDelta,
      idleHoursDelta,
      distanceFromSiteCenter,
    };
  }

  /**
   * Clears in-memory state (useful for testing or service restart).
   */
  public static reset(): void {
    equipmentStateMap.clear();
    siteCenterMap.clear();
  }
}
