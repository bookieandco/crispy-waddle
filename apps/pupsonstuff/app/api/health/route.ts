import { NextResponse } from 'next/server';
import { getPlatformConfig, rest } from '@/lib/platform';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProbeRow {
  id: string;
}

/**
 * Public liveness/readiness probe.
 *
 * It reveals no credential values and no customer/order data. A 200 means the
 * deployed Next.js runtime can reach the dedicated PupsonStuff Supabase
 * service boundary. Provider/sample certification remains a separate,
 * authenticated launch gate.
 */
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null;
  const environment = process.env.VERCEL_ENV ?? 'unknown';
  const fulfillmentMode = process.env.PUPSON_FULFILLMENT_MODE ?? 'unset';

  if (!getPlatformConfig()) {
    return NextResponse.json(
      {
        service: 'pupsonstuff',
        status: 'degraded',
        database: 'not_configured',
        environment,
        fulfillmentMode,
        commit,
      },
      { status: 503 }
    );
  }

  try {
    await rest<ProbeRow[]>('pupson_usage_events?select=id&limit=1');
    return NextResponse.json({
      service: 'pupsonstuff',
      status: 'ok',
      database: 'reachable',
      environment,
      fulfillmentMode,
      commit,
    });
  } catch {
    return NextResponse.json(
      {
        service: 'pupsonstuff',
        status: 'degraded',
        database: 'unreachable',
        environment,
        fulfillmentMode,
        commit,
      },
      { status: 503 }
    );
  }
}
