import { NextResponse } from 'next/server';
import { evaluateDirectorMediaReviewGate, type DirectorMediaReviewGateInput } from '@jhadina/director-core/media-review-gate-adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request): boolean {
  const secret = process.env.DIRECTOR_INTERNAL_API_SECRET ?? process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  let input: DirectorMediaReviewGateInput;
  try { input = await request.json() as DirectorMediaReviewGateInput; }
  catch { return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }); }

  const decision = evaluateDirectorMediaReviewGate(input);
  return NextResponse.json({ ok: decision.allowed, decision }, { status: decision.allowed ? 200 : 409 });
}
