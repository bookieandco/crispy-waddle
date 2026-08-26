import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createSupabaseGeneratedAssetRepository } from '@/lib/supabase-generated-asset-repository';
import { approvedEditingAssets } from '@jhadina/director-core/editing-asset-manifest';

function parseProjectId(value: string | null): string | null {
  const projectId = value?.trim();
  return projectId ? projectId : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const projectId = parseProjectId(new URL(request.url).searchParams.get('projectId'));
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Durable asset storage is not configured' }, { status: 503 });

  const repository = createSupabaseGeneratedAssetRepository(privileged);
  const assets = await repository.listByProject(projectId);
  const { data: approvals, error } = await privileged
    .from('director_editing_asset_approvals')
    .select('asset_id, approval_id, approved_at')
    .in('asset_id', assets.map((asset) => asset.id));
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const approved = new Set((approvals ?? []).map((row) => row.asset_id));
  return NextResponse.json({ ok: true, projectId, assets: approvedEditingAssets(assets, approved) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const body = await request.json() as { projectId?: string; assetId?: string };
  const projectId = body.projectId?.trim();
  const assetId = body.assetId?.trim();
  if (!projectId || !assetId) return NextResponse.json({ ok: false, error: 'projectId and assetId are required' }, { status: 400 });

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Durable asset storage is not configured' }, { status: 503 });

  const { data: asset, error: assetError } = await privileged
    .from('director_generated_editing_assets')
    .select('id, project_id')
    .eq('id', assetId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (assetError) return NextResponse.json({ ok: false, error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ ok: false, error: 'Generated asset not found for project' }, { status: 404 });

  const approvalId = `approval:${assetId}:${user.id}`;
  const { error } = await privileged.from('director_editing_asset_approvals').upsert({
    asset_id: assetId,
    approval_id: approvalId,
    approved_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, assetId, approvalId });
}
