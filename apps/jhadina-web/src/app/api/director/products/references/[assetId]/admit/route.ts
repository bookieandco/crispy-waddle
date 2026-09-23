import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { scanDirectorReferenceMedia, type DirectorReferenceMime } from '@/lib/director-reference-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  const { assetId } = await context.params;
  let body: { projectId?: string };
  try {
    body = await request.json() as { projectId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }
  const projectId = body.projectId?.trim();
  if (!projectId || !assetId?.trim()) {
    return NextResponse.json({ ok: false, error: 'projectId and assetId are required' }, { status: 400 });
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

  const { data: asset, error: readError } = await privileged
    .from('director_reference_media_assets')
    .select('id,project_id,bucket_id,object_path,mime_type,byte_size,sha256,reference_kind,admission_status,scan_status')
    .eq('id', assetId)
    .eq('project_id', projectId)
    .eq('reference_kind', 'product')
    .maybeSingle();

  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_REFERENCE_NOT_FOUND' }, { status: 404 });
  if (asset.admission_status === 'admitted' && asset.scan_status === 'clean') {
    return NextResponse.json({ ok: true, assetId, admissionStatus: 'admitted', scanStatus: 'clean' });
  }
  if (asset.admission_status === 'rejected') {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_PRODUCT_REFERENCE_REJECTED' }, { status: 409 });
  }

  const { data: signed, error: signError } = await privileged.storage
    .from(String(asset.bucket_id))
    .createSignedUrl(String(asset.object_path), 300);
  if (signError || !signed?.signedUrl) {
    return NextResponse.json(
      { ok: false, error: `DIRECTOR_REFERENCE_SCAN_SIGN_FAILED:${signError?.message ?? 'missing signed URL'}` },
      { status: 502 },
    );
  }

  let result;
  try {
    result = await scanDirectorReferenceMedia({
      signedUrl: signed.signedUrl,
      sha256: String(asset.sha256),
      mimeType: String(asset.mime_type) as DirectorReferenceMime,
      byteSize: Number(asset.byte_size),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_REFERENCE_SCAN_FAILED';
    if (message === 'DIRECTOR_MEDIA_SCANNER_NOT_CONFIGURED') {
      return NextResponse.json({ ok: false, error: message, admissionStatus: 'quarantined' }, { status: 503 });
    }
    await privileged
      .from('director_reference_media_assets')
      .update({ scan_status: 'error', rejection_reason: 'scanner-error', updated_at: new Date().toISOString() })
      .eq('id', assetId)
      .eq('project_id', projectId);
    return NextResponse.json({ ok: false, error: message, admissionStatus: 'quarantined' }, { status: 502 });
  }

  const now = new Date().toISOString();
  if (!result.clean || !result.safe) {
    const { error } = await privileged
      .from('director_reference_media_assets')
      .update({
        admission_status: 'rejected',
        scan_status: 'unsafe',
        scan_evidence_ids: result.evidenceIds,
        rejection_reason: result.reason ?? 'media-scan-rejected',
        updated_at: now,
      })
      .eq('id', assetId)
      .eq('project_id', projectId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: false,
      error: 'DIRECTOR_PRODUCT_REFERENCE_SCAN_REJECTED',
      admissionStatus: 'rejected',
      evidenceIds: result.evidenceIds,
    }, { status: 422 });
  }

  const { error } = await privileged
    .from('director_reference_media_assets')
    .update({
      admission_status: 'admitted',
      scan_status: 'clean',
      scan_evidence_ids: result.evidenceIds,
      rejection_reason: null,
      admitted_at: now,
      updated_at: now,
    })
    .eq('id', assetId)
    .eq('project_id', projectId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    assetId,
    admissionStatus: 'admitted',
    scanStatus: 'clean',
    evidenceIds: result.evidenceIds,
  });
}
