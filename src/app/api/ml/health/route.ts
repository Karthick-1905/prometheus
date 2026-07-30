import { NextResponse } from 'next/server';

const ML_SERVER_URL = process.env.ML_SERVER_URL ?? 'http://localhost:8000';

/**
 * GET /api/ml/health
 * Proxy to Python ML server health + model load status.
 */
export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${ML_SERVER_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    const data = await res.json();
    return NextResponse.json({
      reachable: true,
      ...data,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        reachable: false,
        status: 'unreachable',
        service: 'CAT Fleet ML — Isolation Forest',
        model_loaded: false,
        model_meta: null,
        error: message,
        hint: 'Start the ML server: npm run ml:server',
      },
      { status: 503 }
    );
  }
}
