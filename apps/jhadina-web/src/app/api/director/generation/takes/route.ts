import { NextResponse } from 'next/server';
import type { TakeRequest } from '@jhadina/director-core/generation-orchestrator';
import type { PlannedGeneration } from '@jhadina/director-core/generation-plan-adapter';
import type { DirectorGenerationGateInput } from '@jhadina/director-core/creative-gate-adapter';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubmitTakeBody = {
  request: TakeRequest;
  plan: PlannedGeneration;
  gate: DirectorGenerationGateInput;
};

function authorized(request: Request): boolean {
  const secret = process.env.DIRECTOR_INTERNAL_API_SECRET ?? process.env.CRON_SECRET;
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

function validBody(value: unknown): value is SubmitTakeBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<SubmitTakeBody>;
  return !!body.request && !!body.plan && !!body.gate
    && typeof body.request.projectId === 'string'
    && typeof body.request.takeId === 'string'
    && typeof body.request.storyboardBoardId === 'string'
    && typeof body.plan.modelId === 'string'
    && body.gate.run?.projectId === body.request.projectId
    && body.gate.storyboardStage?.projectId === body.request.projectId
    && body.gate.generationStage?.projectId === body.request.projectId;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }); }
  if (!validBody(body)) return NextResponse.json({ ok: false, error: 'INVALID_DIRECTOR_TAKE_REQUEST' }, { status: 400 });

  const client = createServiceRoleClient();
  if (!client) return NextResponse.json({ ok: false, error: 'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 });

  try {
    const { generation } = createConfiguredDirectorGenerationRuntime(client);
    const job = await generation.submitTake(body.request, body.plan, body.gate);
    return NextResponse.json({ ok: true, job });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Director generation submission failed.';
    const blocked = message.startsWith('Generation submission blocked:') || message.includes('does not match');
    return NextResponse.json({ ok: false, error: message }, { status: blocked ? 409 : 500 });
  }
}
