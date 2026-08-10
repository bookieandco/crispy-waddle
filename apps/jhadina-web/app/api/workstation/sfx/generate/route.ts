import { NextResponse } from 'next/server';
import { getSfxProvider } from '@jhadina/director-core/sfx-provider';

type Body = {
  prompt: string;
  durationSeconds: number;
  action?: string;
  materials?: string[];
  perspective?: 'close' | 'medium' | 'wide' | 'first-person';
  intensity?: 'subtle' | 'medium' | 'strong';
  approved?: boolean;
};

export async function POST(request: Request) {
  const body = await request.json() as Body;

  if (!body.prompt?.trim() || !Number.isFinite(body.durationSeconds) || body.durationSeconds <= 0) {
    return NextResponse.json({ ok: false, error: 'prompt and positive durationSeconds are required' }, { status: 400 });
  }

  if (!body.approved) {
    return NextResponse.json({
      ok: false,
      status: 'pending_approval',
      reason: 'SFX generation requires approval before provider execution.',
    }, { status: 202 });
  }

  const candidates = await getSfxProvider().generate({
    prompt: body.prompt.trim(),
    durationSeconds: body.durationSeconds,
    action: body.action,
    materials: body.materials,
    perspective: body.perspective,
    intensity: body.intensity,
  });

  return NextResponse.json({
    ok: true,
    status: 'completed',
    candidates,
    audit: {
      event: 'director.sfx.generated',
      provider: candidates[0]?.provider ?? 'unknown',
      candidateCount: candidates.length,
    },
  });
}
