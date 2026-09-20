import { NextResponse } from 'next/server';
import type { CreativeGate, ProductionRun } from '@jhadina/shotlist-core/production';
import type { CreativeStage, PlannedGeneration, TakeRequest } from '@jhadina/director-core';
import { createConfiguredDirectorGenerationRuntime } from '@/lib/director-generation-composition';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SubmitTakeBody = {
  take: TakeRequest;
  plan: PlannedGeneration;
  authority: {
    run: ProductionRun;
    gate: CreativeGate;
    storyboardStage: CreativeStage;
    generationStage: CreativeStage;
  };
};

function isBody(value: unknown): value is SubmitTakeBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<SubmitTakeBody>;
  return !!body.take && !!body.plan && !!body.authority
    && typeof body.take.projectId === 'string'
    && typeof body.take.storyboardBoardId === 'string'
    && typeof body.take.takeId === 'string'
    && typeof body.plan.modelId === 'string';
}

export async function POST(request: Request) {
  const secret = process.env.DIRECTOR_API_SECRET;
  const authorization = request.headers.get('authorization');
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_INVALID_JSON' }, { status: 400 });
  }
  if (!isBody(body)) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_INVALID_TAKE_REQUEST' }, { status: 400 });
  }

  // The request may name IDs and current gate/stage facts, but it can never
  // supply storyboard lineage or creative provenance. GenerationPlanAdapter
  // resolves lineage from service-role persistence and derives provenance.
  const runtime = await createConfiguredDirectorGenerationRuntime(client);
  if (!runtime.hasModel(body.plan.modelId)) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_MODEL_NOT_REGISTERED' }, { status: 400 });
  }

  try {
    const job = await runtime.generation.submitTake(body.take, body.plan, body.authority);
    return NextResponse.json({ ok: true, job }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_GENERATION_SUBMISSION_FAILED' },
      { status: 409 },
    );
  }
}
