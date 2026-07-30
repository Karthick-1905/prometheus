import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { Equipment, EquipmentStatus } from '@prisma/client';

export class EquipmentRepository {
  /**
   * Upserts the current state of an equipment item using serialNumber.
   */
  public async upsertEquipment(telemetry: ValidatedTelemetry, tx?: any): Promise<Equipment> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const code = telemetry.equipmentId;
    const dealerIdInt = parseInt(telemetry.dealerId) || 1;

    let eqStatus: EquipmentStatus = EquipmentStatus.AVAILABLE;
    if (telemetry.rentalStatus === 'Maintenance') {
      eqStatus = EquipmentStatus.MAINTENANCE;
    } else if (['Working', 'Idle'].includes(telemetry.rentalStatus)) {
      eqStatus = EquipmentStatus.RENTED;
    }

    // Ensure dealer exists
    let dealer = await db.dealer.findFirst({ where: { dealerId: dealerIdInt } });
    if (!dealer) {
      dealer = await db.dealer.create({
        data: {
          dealerId: dealerIdInt,
          dealerName: `Dealer ${telemetry.dealerId}`,
        },
      });
    }

    const existing = await db.equipment.findFirst({
      where: {
        OR: [
          { serialNumber: code },
          { equipmentId: parseInt(code) || -1 },
        ],
      },
    });

    if (existing) {
      return db.equipment.update({
        where: { equipmentId: existing.equipmentId },
        data: {
          equipmentType: telemetry.equipmentType,
          dealerId: dealer.dealerId,
          status: eqStatus,
          updatedAt: timestamp,
        },
      });
    }

    return db.equipment.create({
      data: {
        serialNumber: code,
        equipmentName: `${telemetry.equipmentType} ${code}`,
        equipmentType: telemetry.equipmentType,
        dealerId: dealer.dealerId,
        status: eqStatus,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    });
  }

  /**
   * Fetches equipment state by serialNumber or equipmentId.
   */
  public async getEquipmentById(equipmentId: string): Promise<Equipment | null> {
    return prisma.equipment.findFirst({
      where: {
        OR: [
          { serialNumber: equipmentId },
          { equipmentId: parseInt(equipmentId) || -1 },
        ],
      },
    });
  }
}
