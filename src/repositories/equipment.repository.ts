import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { Equipment, RentalStatus } from '@prisma/client';

export class EquipmentRepository {
  /**
   * Upserts the current state of an equipment item.
   * If the equipment does not exist, it is created.
   * If it exists, its location, operator, rental status, and lastSeen are updated.
   */
  public async upsertEquipment(telemetry: ValidatedTelemetry, tx?: any): Promise<Equipment> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);

    return db.equipment.upsert({
      where: {
        equipmentId: telemetry.equipmentId,
      },
      update: {
        equipmentType: telemetry.equipmentType,
        dealerId: telemetry.dealerId,
        currentSite: telemetry.siteId || null,
        currentOperator: telemetry.operatorId || null,
        rentalStatus: telemetry.rentalStatus as RentalStatus,
        lastSeen: timestamp,
      },
      create: {
        equipmentId: telemetry.equipmentId,
        equipmentType: telemetry.equipmentType,
        dealerId: telemetry.dealerId,
        currentSite: telemetry.siteId || null,
        currentOperator: telemetry.operatorId || null,
        rentalStatus: telemetry.rentalStatus as RentalStatus,
        lastSeen: timestamp,
      },
    });
  }

  /**
   * Fetches equipment state by equipmentId.
   */
  public async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    return prisma.equipment.findUnique({
      where: { equipmentId },
    });
  }
}
