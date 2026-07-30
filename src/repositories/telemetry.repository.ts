import { prisma } from '../lib/prisma';
import { ValidatedTelemetry } from '../schemas/telemetry.schema';
import { UsageLog } from '@prisma/client';

export class TelemetryRepository {
  /**
   * Checks if a telemetry packet with exact equipmentId and timestamp already exists.
   */
  public async isDuplicatePacket(equipmentId: string, timestamp: Date): Promise<boolean> {
    const eqId = parseInt(equipmentId) || 1;

    const assignment = await prisma.equipmentAssignment.findFirst({
      where: {
        contract: {
          equipmentId: eqId,
        },
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      return false;
    }

    const count = await prisma.usageLog.count({
      where: {
        assignmentId: assignment.assignmentId,
        recordedAt: timestamp,
      },
    });
    return count > 0;
  }

  /**
   * Inserts a single telemetry record into the database as a UsageLog.
   */
  public async createTelemetry(telemetry: ValidatedTelemetry, tx?: any): Promise<UsageLog> {
    const db = tx || prisma;
    const timestamp = new Date(telemetry.timestamp);
    const eqId = parseInt(telemetry.equipmentId) || 1;
    const dId = parseInt(telemetry.dealerId) || 1;

    let assignment = await db.equipmentAssignment.findFirst({
      where: {
        contract: {
          equipmentId: eqId,
        },
        status: 'ACTIVE',
      },
    });

    if (!assignment) {
      // Setup necessary parent records if they do not exist
      let company = await db.company.findFirst();
      if (!company) {
        company = await db.company.create({
          data: {
            companyId: 1,
            companyName: 'Default Company',
          },
        });
      }

      let dealer = await db.dealer.findFirst({
        where: { dealerId: dId },
      });
      if (!dealer) {
        dealer = await db.dealer.create({
          data: {
            dealerId: dId,
            dealerName: 'Default Dealer',
          },
        });
      }

      let equipment = await db.equipment.findFirst({
        where: { equipmentId: eqId },
      });
      if (!equipment) {
        equipment = await db.equipment.create({
          data: {
            equipmentId: eqId,
            dealerId: dId,
            equipmentType: telemetry.equipmentType,
            status: 'AVAILABLE',
          },
        });
      }

      let contract = await db.rentalContract.findFirst({
        where: {
          equipmentId: eqId,
          rentalStatus: 'ACTIVE',
        },
      });
      if (!contract) {
        contract = await db.rentalContract.create({
          data: {
            equipmentId: eqId,
            dealerId: dId,
            companyId: company.companyId,
            rentalStatus: 'ACTIVE',
            rentalStart: timestamp,
          },
        });
      }

      let projectSite = await db.projectSite.findFirst();
      if (!projectSite) {
        projectSite = await db.projectSite.create({
          data: {
            siteId: 1,
            companyId: company.companyId,
            siteName: 'Default Site',
            status: 'ACTIVE',
          },
        });
      }

      let user = await db.user.findFirst();
      if (!user) {
        user = await db.user.create({
          data: {
            userId: 1,
            companyId: company.companyId,
            name: 'Default User',
            role: 'FLEET_MANAGER',
          },
        });
      }

      assignment = await db.equipmentAssignment.create({
        data: {
          contractId: contract.contractId,
          siteId: projectSite.siteId,
          assignedBy: user.userId,
          checkedOutBy: user.userId,
          status: 'ACTIVE',
          checkoutTime: timestamp,
        },
      });
    }

    return db.usageLog.create({
      data: {
        assignmentId: assignment.assignmentId,
        runtimeHours: telemetry.engineHours,
        idleHours: telemetry.idleHours,
        fuelConsumed: telemetry.fuelLevel,
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        recordedAt: timestamp,
      },
    });
  }
}
