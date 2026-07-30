import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { RentalContract, RentalContractStatus } from '@prisma/client';

export class RentalRepository {
  /**
   * Updates or creates business rental records based on equipment telemetry and rental status.
   */
  public async syncRentalInfo(telemetry: ValidatedTelemetry, tx?: any): Promise<RentalContract | null> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const eqId = parseInt(telemetry.equipmentId) || 1;
    const dId = parseInt(telemetry.dealerId) || 1;

    // Find active contract
    const activeContract = await db.rentalContract.findFirst({
      where: {
        equipmentId: eqId,
        rentalStatus: RentalContractStatus.ACTIVE,
      },
      orderBy: {
        rentalStart: 'desc',
      },
    });

    if (telemetry.rentalStatus === 'Returned') {
      if (activeContract) {
        return db.rentalContract.update({
          where: { contractId: activeContract.contractId },
          data: {
            actualReturn: timestamp,
            rentalStatus: RentalContractStatus.COMPLETED,
          },
        });
      }
      return null;
    }

    if (activeContract) {
      return activeContract;
    }

    // Create new rental contract (assuming companyId 1 exists in DB)
    return db.rentalContract.create({
      data: {
        equipmentId: eqId,
        dealerId: dId,
        companyId: 1,
        rentalStart: timestamp,
        rentalStatus: RentalContractStatus.ACTIVE,
      },
    });
  }
}
