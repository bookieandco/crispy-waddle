import { NextResponse } from 'next/server';
import {
  createAdMultiplierPlan,
  type AdMultiplierPlan,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  plan?: Omit<AdMultiplierPlan, 'authority'> | AdMultiplierPlan;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  let body: Body;
  try {
    body = await request.json() as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const projectId = body.projectId?.trim() ?? '';
  if (!projectId || !body.plan) {
    return NextResponse.json({ ok: false, error: 'projectId and plan are required' }, { status: 400 });
  }

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_PROJECT_ACCESS_DENIED' },
      { status: 403 },
    );
  }

  let plan: AdMultiplierPlan;
  try {
    const withoutAuthority = Object.fromEntries(
      Object.entries(body.plan).filter(([key]) => key !== 'authority'),
    ) as Omit<AdMultiplierPlan, 'authority'>;
    plan = createAdMultiplierPlan(withoutAuthority);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_AD_MULTIPLIER_INVALID' },
      { status: 400 },
    );
  }

  if (plan.projectId !== projectId) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_AD_PROJECT_MISMATCH' }, { status: 409 });
  }

  const { data: source, error: sourceError } = await privileged
    .from('director_commercial_creatives')
    .select('id,project_id')
    .eq('id', plan.sourceCreativeId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (sourceError) return NextResponse.json({ ok: false, error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ ok: false, error: 'DIRECTOR_AD_SOURCE_CREATIVE_NOT_FOUND' }, { status: 404 });

  const now = new Date().toISOString();
  const { data, error } = await privileged
    .from('director_ad_multiplier_plans')
    .insert({
      id: plan.id,
      project_id: projectId,
      source_creative_id: plan.sourceCreativeId,
      plan,
      created_by_user_id: user.id,
      created_at: now,
      updated_at: now,
    })
    .select('id,project_id,source_creative_id,plan,created_at')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });

  return NextResponse.json({
    ok: true,
    multiplier: data,
    experimentIsolation: plan.experimentIsolation,
    campaignAuthority: 'NONE',
  }, { status: 201 });
}
