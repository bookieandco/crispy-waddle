import { NextResponse } from 'next/server';
import {
  planCharacterReferenceBootstrap,
  validateCharacterCastRecord,
  type CharacterCastRecord,
  type CharacterReferenceUpload,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  characterId?: string;
  displayName?: string;
  archetype?: 'human' | 'cartoon' | 'puppet' | 'creature';
  referenceAssetIds?: string[];
  requestedAppearanceLabels?: string[];
  buildMotionProbes?: boolean;
  commercialUse?: boolean;
  lockedTraits?: string[];
};

const CHARACTER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

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
  const characterId = body.characterId?.trim() ?? '';
  const displayName = body.displayName?.trim() ?? '';
  const archetype = body.archetype;
  const referenceAssetIds = [...new Set((body.referenceAssetIds ?? []).map((value) => value.trim()).filter(Boolean))];

  if (!projectId || !characterId || !displayName || !archetype || !referenceAssetIds.length) {
    return NextResponse.json({
      ok: false,
      error: 'projectId, characterId, displayName, archetype and referenceAssetIds are required',
    }, { status: 400 });
  }
  if (!CHARACTER_ID.test(characterId)) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_CHARACTER_ID_INVALID' }, { status: 400 });
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

  const { data: rows, error: referenceError } = await privileged
    .from('director_reference_media_assets')
    .select('id,project_id,sha256,width,height,view_hint,rights_ref,consent_ref,scan_evidence_ids,admission_status,scan_status')
    .eq('project_id', projectId)
    .in('id', referenceAssetIds);

  if (referenceError) return NextResponse.json({ ok: false, error: referenceError.message }, { status: 500 });
  if ((rows ?? []).length !== referenceAssetIds.length) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_CHARACTER_REFERENCE_SET_INCOMPLETE' }, { status: 409 });
  }
  if ((rows ?? []).some((row) => row.admission_status !== 'admitted' || row.scan_status !== 'clean')) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_CHARACTER_REFERENCES_NOT_ADMITTED' }, { status: 409 });
  }

  const byId = new Map((rows ?? []).map((row) => [String(row.id), row]));
  const uploads: CharacterReferenceUpload[] = referenceAssetIds.map((id) => {
    const row = byId.get(id)!;
    return {
      id,
      assetId: id,
      sha256: String(row.sha256),
      width: Number(row.width),
      height: Number(row.height),
      view: row.view_hint as CharacterReferenceUpload['view'],
      rightsRef: String(row.rights_ref),
      ...(row.consent_ref ? { consentRef: String(row.consent_ref) } : {}),
      evidenceIds: Array.isArray(row.scan_evidence_ids) ? row.scan_evidence_ids.map(String) : [],
    };
  });

  const jobId = `character-bootstrap:${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  let plan;
  try {
    plan = planCharacterReferenceBootstrap({
      id: jobId,
      projectId,
      characterId,
      displayName,
      archetype,
      uploads,
      requestedAppearanceLabels: body.requestedAppearanceLabels ?? [],
      buildMotionProbes: body.buildMotionProbes !== false,
      commercialUse: body.commercialUse !== false,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_CHARACTER_BOOTSTRAP_INVALID' },
      { status: 400 },
    );
  }

  const baseVariantId = `appearance:${characterId}:base`;
  const lockedTraits = [...new Set(
    (body.lockedTraits ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
      .concat('preserve exact canonical face/body identity from approved reference media'),
  )];

  const cast: CharacterCastRecord = {
    id: `cast:${projectId}:${characterId}`,
    projectId,
    characterId,
    displayName,
    archetype,
    continuityRef: plan.continuityRef,
    canonicalAppearanceVariantId: baseVariantId,
    appearanceVariants: [{
      id: baseVariantId,
      characterId,
      kind: 'base',
      label: 'Canonical uploaded reference',
      referenceAssetIds,
      referenceSha256s: uploads.map((upload) => upload.sha256),
      approvedAt: now,
      approvedBy: user.id,
    }],
    lockedTraits,
    approvedAt: now,
    approvedBy: user.id,
  };

  const castErrors = validateCharacterCastRecord(cast);
  if (castErrors.length) {
    return NextResponse.json({ ok: false, error: `DIRECTOR_CAST_INVALID:${castErrors.join(';')}` }, { status: 400 });
  }

  const { data, error } = await privileged.rpc('create_director_character_bootstrap_job', {
    p_job_id: jobId,
    p_project_id: projectId,
    p_user_id: user.id,
    p_character_id: characterId,
    p_display_name: displayName,
    p_archetype: archetype,
    p_reference_asset_ids: referenceAssetIds,
    p_requested_appearance_labels: body.requestedAppearanceLabels ?? [],
    p_build_motion_probes: body.buildMotionProbes !== false,
    p_commercial_use: body.commercialUse !== false,
    p_bootstrap_plan: plan,
    p_cast_record: cast,
    p_now: now,
  });

  if (error) {
    const status = error.message.includes('already exists') ? 409 : 500;
    return NextResponse.json({ ok: false, error: error.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    characterId,
    continuityRef: cast.continuityRef,
    castRecordId: cast.id,
    bootstrapJob: data,
    status: 'reference_locked',
    next: 'reference-aware video generation may start immediately; derived angles/expressions remain enhancement work',
  }, { status: 201 });
}
