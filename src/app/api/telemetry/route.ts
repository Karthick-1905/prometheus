import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/telemetry
 * Returns the latest UsageLog per equipment, joined with Equipment details.
 * Used by the dashboard fleet status grid.
 */
export async function GET(_request: NextRequest) {
  try {
    // Get latest UsageLog entry per assignment (last recorded_at)
    const latestLogs = await prisma.usageLog.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 500,
      include: {
        assignment: {
          include: {
            contract: {
              include: {
                equipment: true,
              },
            },
            site: true,
          },
        },
      },
    });

    // Deduplicate: keep only the latest entry per equipment
    const seen = new Set<number>();
    const unique = latestLogs.filter((log) => {
      const eqId = log.assignment.contract.equipmentId;
      if (seen.has(eqId)) return false;
      seen.add(eqId);
      return true;
    });

    const snapshot = unique.map((log) => ({
      equipmentId: log.assignment.contract.equipment.equipmentId,
      equipmentType: log.assignment.contract.equipment.equipmentType,
      status: log.assignment.contract.equipment.status,
      siteName: log.assignment.site?.siteName ?? 'Unassigned',
      runtimeHours: log.runtimeHours,
      idleHours: log.idleHours,
      fuelLevel: log.fuelConsumed,
      latitude: log.latitude,
      longitude: log.longitude,
      recordedAt: log.recordedAt,
    }));

    return NextResponse.json({ success: true, snapshot });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
