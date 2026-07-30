import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/alerts
 * Returns the most recent anomaly alerts.
 * Query params:
 *   - resolved=true|false (default: false — active alerts only)
 *   - limit=N (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = searchParams.get('resolved') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

    const alerts = await prisma.anomalyAlert.findMany({
      where: { isResolved: resolved },
      orderBy: { detectedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, alerts });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/alerts
 * Resolves an alert by alertId.
 * Body: { alertId: number }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { alertId } = body;

    if (!alertId || typeof alertId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'alertId (number) is required in request body' },
        { status: 400 }
      );
    }

    const updated = await prisma.anomalyAlert.update({
      where: { alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, alert: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
