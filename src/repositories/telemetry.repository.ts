import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { Telemetry } from '@prisma/client';

export class TelemetryRepository {
  /**
   * Checks if a telemetry packet with exact equipmentId and timestamp already exists (Duplicate packet check).
   */
  public async isDuplicatePacket(equipmentId: string, timestamp: Date): Promise<boolean> {
    const count = await prisma.telemetry.count({
      where: {
        equipmentId,
        timestamp,
      },
    });
    return count > 0;
  }

  /**
   * Inserts a single telemetry record into the database.
   */
  public async createTelemetry(telemetry: ValidatedTelemetry, tx?: any): Promise<Telemetry> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);

    return db.telemetry.create({
      data: {
        equipmentId: telemetry.equipmentId,
        timestamp,
        fuelLevel: telemetry.fuelLevel,
        engineHours: telemetry.engineHours,
        idleHours: telemetry.idleHours,
        speed: telemetry.speed,
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        engineTemperature: telemetry.engineTemperature,
        hydraulicPressure: telemetry.hydraulicPressure,
        batteryVoltage: telemetry.batteryVoltage,
        loadPercentage: telemetry.loadPercentage,
        vibrationLevel: telemetry.vibrationLevel,
      },
    });
  }
}
