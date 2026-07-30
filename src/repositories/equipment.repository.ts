import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { Equipment, EquipmentStatus } from '@prisma/client';

export class EquipmentRepository {
  /**
   * Upserts the current state of an equipment item.
   * If the equipment does not exist, it is created.
   * If it exists, its status is updated.
   */
  public async upsertEquipment(telemetry: ValidatedTelemetry, tx?: any): Promise<Equipment> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const eqId = parseInt(telemetry.equipmentId) || 1;
    const dId = parseInt(telemetry.dealerId) || 1;

    let eqStatus: EquipmentStatus = EquipmentStatus.AVAILABLE;
    if (telemetry.rentalStatus === 'Maintenance') {
      eqStatus = EquipmentStatus.MAINTENANCE;
    } else if (['Working', 'Idle'].includes(telemetry.rentalStatus)) {
      eqStatus = EquipmentStatus.RENTED;
    }

    return db.equipment.upsert({
      where: {
        equipmentId: eqId,
      },
      update: {
        equipmentType: telemetry.equipmentType,
        dealerId: dId,
        status: eqStatus,
        updatedAt: timestamp,
      },
      create: {
        equipmentId: eqId,
        equipmentType: telemetry.equipmentType,
        dealerId: dId,
        status: eqStatus,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  /**
   * Fetches equipment state by equipmentId.
   */
  public async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    const eqId = parseInt(equipmentId) || 1;
    return prisma.equipment.findUnique({
      where: { equipmentId: eqId },
    });
  }
}
