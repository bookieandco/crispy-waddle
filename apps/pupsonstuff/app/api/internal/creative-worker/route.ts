import { NextRequest, NextResponse } from 'next/server';
import { runQueuedCreativeJobs } from '@/lib/creative-jobs';

export const runtime = 'nodejs';
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Durable catch-up worker for creative jobs that survived the originating
 * request. Claiming is atomic at the job status boundary, so the request's
 * after() runner and this worker cannot both submit the same queued job.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }
  const result = await runQueuedCreativeJobs(2);
  return NextResponse.json({ success: true, ...result });
}
