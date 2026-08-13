import { NextResponse } from 'next/server';

const pendingRegions = new Map<string, { id: string; projectId: string; clipId: string; startSeconds: number; durationSeconds: number; instruction: string; status: 'pending_approval' }>();

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.projectId || !body.clipId || !body.instruction || typeof body.startSeconds !== 'number' || typeof body.durationSeconds !== 'number') {
    return NextResponse.json({ ok: false, error: 'projectId, clipId, instruction, startSeconds and durationSeconds are required' }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const region = { id, projectId: body.projectId, clipId: body.clipId, startSeconds: body.startSeconds, durationSeconds: body.durationSeconds, instruction: body.instruction, status: 'pending_approval' as const };
  pendingRegions.set(id, region);
  return NextResponse.json({ ok: true, region, requiresApproval: true }, { status: 202 });
}

export async function GET() {
  return NextResponse.json({ ok: true, regions: [...pendingRegions.values()] });
}
