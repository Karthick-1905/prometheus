import { NextRequest, NextResponse } from 'next/server';

const ML_SERVER_URL = process.env.ML_SERVER_URL ?? 'http://localhost:8000';

/**
 * POST /api/ml/predict
 * Proxy to Python Isolation Forest /predict.
 * Body: 6-dim rental feature vector (engineHoursPerDay, idleHoursPerDay, …).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${ML_SERVER_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            (data as { detail?: string }).detail ??
            `ML server returned ${res.status}`,
        },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true, result: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        error: isAbort ? 'ML server timed out' : message,
        hint: 'Start the ML server: npm run ml:server',
      },
      { status: 503 }
    );
  }
}
