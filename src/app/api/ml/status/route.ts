import { NextResponse } from 'next/server';

const ML_SERVER_URL = process.env.ML_SERVER_URL ?? 'http://localhost:8000';

/**
 * GET /api/ml/status
 * Proxy to Python ML model metadata.
 */
export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${ML_SERVER_URL}/model/status`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { success: false, error: text || `ML server returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        loaded: false,
        error: message,
        hint: 'Start the ML server: npm run ml:server',
      },
      { status: 503 }
    );
  }
}
