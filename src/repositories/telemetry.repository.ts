import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { EquipmentTelemetry } from '@prisma/client';

export class TelemetryRepository {
  /**
   * Helper to find or auto-create Equipment by serialNumber string (e.g. "CAT-EX-1001").
   */
  public async resolveEquipmentId(telemetry: ValidatedTelemetry, tx?: any): Promise<number> {
    const db = tx || prisma;
    const code = telemetry.equipmentId;

    // Try finding by serialNumber string or fallback to integer parsing
    let equipment = await db.equipment.findFirst({
      where: {
        OR: [
          { serialNumber: code },
          { equipmentId: parseInt(code) || -1 },
        ],
      },
    });

    if (!equipment) {
      const dealerIdInt = parseInt(telemetry.dealerId) || 1;
      let dealer = await db.dealer.findFirst({ where: { dealerId: dealerIdInt } });
      if (!dealer) {
        dealer = await db.dealer.create({
          data: {
            dealerId: dealerIdInt,
            dealerName: `Dealer ${telemetry.dealerId}`,
          },
        });
      }

      equipment = await db.equipment.create({
        data: {
          serialNumber: code,
          equipmentName: `${telemetry.equipmentType} ${code}`,
          equipmentType: telemetry.equipmentType,
          dealerId: dealer.dealerId,
          status: 'RENTED',
        },
      });
    }

    return equipment.equipmentId;
  }

  /**
   * Checks if a telemetry packet with exact equipmentId and timestamp already exists in EquipmentTelemetry.
   */
  public async isDuplicatePacket(telemetry: ValidatedTelemetry, timestamp: Date): Promise<boolean> {
    const eqId = await this.resolveEquipmentId(telemetry);

    const count = await prisma.equipmentTelemetry.count({
      where: {
        equipmentId: eqId,
        timestamp,
      },
    });
    return count > 0;
  }

  /**
   * Inserts a single raw telemetry record into the EquipmentTelemetry model.
   */
  public async createTelemetry(telemetry: ValidatedTelemetry, tx?: any): Promise<EquipmentTelemetry> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const eqId = await this.resolveEquipmentId(telemetry, db);

    return db.equipmentTelemetry.create({
      data: {
        equipmentId: eqId,
        timestamp,
        engineStatus: telemetry.engineStatus,
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
        rentalStatus: telemetry.rentalStatus,
      },
    });
  }
}
