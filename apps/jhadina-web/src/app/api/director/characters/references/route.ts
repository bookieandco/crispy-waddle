import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import {
  DIRECTOR_REFERENCE_MAX_BYTES,
  inspectDirectorReferenceImage,
  safeDirectorReferenceFilename,
} from '@/lib/director-reference-media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VIEWS = new Set([
  'unknown','front','profile-left','profile-right','three-quarter-left',
  'three-quarter-right','full-body','close-up',
]);

function textField(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const projectId = textField(form, 'projectId');
  const rightsRef = textField(form, 'rightsRef');
  const consentRef = textField(form, 'consentRef');
  const requestedView = textField(form, 'viewHint') || 'unknown';
  const viewHint = VIEWS.has(requestedView) ? requestedView : 'unknown';

  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'file is required' }, { status: 400 });
  if (!projectId || !rightsRef) {
    return NextResponse.json({ ok: false, error: 'projectId and rightsRef are required' }, { status: 400 });
  }
  if (file.size <= 0 || file.size > DIRECTOR_REFERENCE_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_REFERENCE_FILE_SIZE_INVALID' }, { status: 400 });
  }

  const privileged = createServiceRoleClient();
  if (!privileged) {
    return NextResponse.json({ ok: false, error: 'Director durable storage is not configured' }, { status: 503 });
  }

  try {
    await requireDirectorProjectAuthority(privileged, { projectId, userId: user.id, capability: 'edit' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_PROJECT_ACCESS_DENIED';
    return NextResponse.json({ ok: false, error: message }, { status: 403 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let inspection;
  try {
    inspection = inspectDirectorReferenceImage(bytes, file.type);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_REFERENCE_IMAGE_INVALID' },
      { status: 400 },
    );
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const { data: existing, error: existingError } = await privileged
    .from('director_reference_media_assets')
    .select('id,project_id,mime_type,byte_size,width,height,sha256,view_hint,admission_status,scan_status')
    .eq('project_id', projectId)
    .eq('sha256', sha256)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true, deduplicated: true, asset: existing }, { status: 200 });
  }

  const assetId = `ref:${crypto.randomUUID()}`;
  const filename = safeDirectorReferenceFilename(file.name);
  const objectPath = `${projectId}/${assetId}/${filename}`;
  const bucketId = 'director-character-references';

  const { error: uploadError } = await privileged.storage
    .from(bucketId)
    .upload(objectPath, bytes, {
      contentType: inspection.mimeType,
      upsert: false,
      cacheControl: '0',
    });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: `DIRECTOR_REFERENCE_UPLOAD_FAILED:${uploadError.message}` }, { status: 502 });
  }

  const row = {
    id: assetId,
    project_id: projectId,
    user_id: user.id,
    bucket_id: bucketId,
    object_path: objectPath,
    original_filename: filename,
    mime_type: inspection.mimeType,
    byte_size: bytes.byteLength,
    width: inspection.width,
    height: inspection.height,
    sha256,
    view_hint: viewHint,
    rights_ref: rightsRef,
    consent_ref: consentRef || null,
    admission_status: 'quarantined',
    scan_status: 'pending',
  };

  const { data, error } = await privileged
    .from('director_reference_media_assets')
    .insert(row)
    .select('id,project_id,mime_type,byte_size,width,height,sha256,view_hint,admission_status,scan_status,created_at')
    .single();

  if (error) {
    await privileged.storage.from(bucketId).remove([objectPath]);
    return NextResponse.json({ ok: false, error: `DIRECTOR_REFERENCE_RECORD_FAILED:${error.message}` }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    deduplicated: false,
    asset: data,
    next: 'scan-and-admit',
  }, { status: 201 });
}
