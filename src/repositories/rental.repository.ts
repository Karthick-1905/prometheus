import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { Rental } from '@prisma/client';

export class RentalRepository {
  /**
   * Updates or creates business rental records based on equipment telemetry and rental status.
   */
  public async syncRentalInfo(telemetry: ValidatedTelemetry, tx?: any): Promise<Rental | null> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const siteId = telemetry.siteId;

    if (!siteId) {
      return null;
    }

    // Find existing open/active rental record for this equipment at this site
    const activeRental = await db.rental.findFirst({
      where: {
        equipmentId: telemetry.equipmentId,
        siteId: siteId,
        checkOutDate: null,
      },
      orderBy: {
        checkInDate: 'desc',
      },
    });

    if (telemetry.rentalStatus === 'Returned') {
      if (activeRental) {
        const diffMs = timestamp.getTime() - activeRental.checkInDate.getTime();
        const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        return db.rental.update({
          where: { id: activeRental.id },
          data: {
            checkOutDate: timestamp,
            rentalDays: days,
            lastOperatorId: telemetry.operatorId || activeRental.lastOperatorId,
          },
        });
      }
      return null;
    }

    if (activeRental) {
      const diffMs = timestamp.getTime() - activeRental.checkInDate.getTime();
      const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return db.rental.update({
        where: { id: activeRental.id },
        data: {
          rentalDays: days,
          lastOperatorId: telemetry.operatorId || activeRental.lastOperatorId,
        },
      });
    }

    // Create new rental record
    return db.rental.create({
      data: {
        equipmentId: telemetry.equipmentId,
        siteId: siteId,
        checkInDate: timestamp,
        checkOutDate: null,
        rentalDays: 1,
        lastOperatorId: telemetry.operatorId || null,
      },
    });
  }
}
