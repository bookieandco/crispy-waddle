import { NextResponse } from 'next/server';
import { rankCandidates } from '@jhadina/director-core';

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.previous || !Array.isArray(body.candidates)) {
    return NextResponse.json({ ok: false, error: 'previous continuity manifest and candidates are required' }, { status: 400 });
  }
  const rankedCandidates = rankCandidates(body.previous, body.candidates);
  return NextResponse.json({ ok: true, count: rankedCandidates.length, candidates: rankedCandidates });
}
