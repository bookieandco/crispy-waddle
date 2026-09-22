import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createSupabaseGeneratedAssetRepository } from '@/lib/supabase-generated-asset-repository';
import { approvedEditingAssets } from '@jhadina/director-core/editing-asset-manifest';
import { validateStudioApprovalEvidence } from '@jhadina/director-core/studio-asset-approval';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

function parseProjectId(value: string | null): string | null {
  const projectId = value?.trim();
  return projectId ? projectId : null;
}

function authorityFailure(error: unknown) {
  const message = error instanceof Error ? error.message : 'DIRECTOR_PROJECT_ACCESS_DENIED';
  const status = message.includes('ACCESS_DENIED') || message.includes('CAPABILITY_DENIED') ? 403 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const projectId = parseProjectId(new URL(request.url).searchParams.get('projectId'));
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId is required' }, { status: 400 });

  const privileged = createServiceRoleClient();
  if (!privileged) return NextResponse.json({ ok: false, error: 'Durable asset storage is not configured' }, { status: 503 });

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'read' });
  } catch (error) {
    return authorityFailure(error);
  }

  const repository = createSupabaseGeneratedAssetRepository(privileged);
  const assets = await repository.listByProject(projectId);
  if (assets.length === 0) return NextResponse.json({ ok: true, projectId, assets: [] });

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

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'approve' });
  } catch (error) {
    return authorityFailure(error);
  }

  const { data: asset, error: assetError } = await privileged
    .from('director_generated_editing_assets')
    .select('id, project_id, approval_policy')
    .eq('id', assetId)
    .eq('project_id', projectId)
    .maybeSingle();
  if (assetError) return NextResponse.json({ ok: false, error: assetError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ ok: false, error: 'Generated asset not found for project' }, { status: 404 });

  let studioQC: { qcReportId: string; minimumObservedScore: number; evidenceIds: string[] } | undefined;
  if (asset.approval_policy === 'studio_qc') {
    const { data: report, error: reportError } = await privileged
      .from('director_studio_qc_reports')
      .select('id, minimum_observed_score, evidence_ids, passed')
      .eq('project_id', projectId)
      .eq('asset_id', assetId)
      .eq('passed', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reportError) return NextResponse.json({ ok: false, error: reportError.message }, { status: 500 });
    if (!report) {
      return NextResponse.json({ ok: false, error: 'Studio QC evidence is required before approval' }, { status: 409 });
    }

    studioQC = {
      qcReportId: String(report.id),
      minimumObservedScore: Number(report.minimum_observed_score),
      evidenceIds: Array.isArray(report.evidence_ids) ? report.evidence_ids.map(String) : [],
    };
    const qcErrors = validateStudioApprovalEvidence(studioQC);
    if (qcErrors.length) {
      return NextResponse.json({ ok: false, error: `Studio QC evidence incomplete: ${qcErrors.join('; ')}` }, { status: 409 });
    }
  }

  const approvalId = `approval:${assetId}:${user.id}`;
  const { error } = await privileged.from('director_editing_asset_approvals').upsert({
    asset_id: assetId,
    approval_id: approvalId,
    approved_at: new Date().toISOString(),
    approved_by_user_id: user.id,
    qc_report_id: studioQC?.qcReportId ?? null,
    qc_min_score: studioQC?.minimumObservedScore ?? null,
    qc_evidence_ids: studioQC?.evidenceIds ?? [],
  }, { onConflict: 'asset_id' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 409 });

  return NextResponse.json({ ok: true, assetId, approvalId, approvalPolicy: asset.approval_policy });
}
