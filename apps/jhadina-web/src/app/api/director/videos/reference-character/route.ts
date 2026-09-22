import { NextResponse } from 'next/server';
import {
  planReferenceCharacterVideo,
  resolveCharacterSceneIdentity,
  type CharacterReferenceBootstrapPlan,
} from '@jhadina/director-core';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { requireDirectorProjectAuthority } from '@/lib/director-project-authority';
import { loadDirectorCastRecord } from '@/lib/director-cast-repository';
import { SupabaseDirectorCharacterReferenceAssetResolver } from '@/lib/director-reference-asset-resolver';
import {
  createAndSubmitAskVideoJob,
  inspectAskVideoIntent,
} from '@/lib/director-video-job-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  projectId?: string;
  characterId?: string;
  prompt?: string;
  appearanceVariantId?: string;
  targetLanguages?: string[];
  dialogueRequired?: boolean;
  clientRequestId?: string;
  targetDurationSeconds?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  mode?: 'standard' | 'short' | 'faceless' | 'long-form';
};

function buildVideoCommand(body: Body): string {
  const prompt = body.prompt?.trim() ?? '';
  if (inspectAskVideoIntent(prompt)) return prompt;
  const mode = body.mode === 'short' ? 'short video' : body.mode === 'long-form' ? 'long-form video' : 'video';
  const duration = Number.isFinite(body.targetDurationSeconds)
    ? ` ${Math.max(1, Math.min(3600, Number(body.targetDurationSeconds)))} seconds`
    : '';
  const aspect = body.aspectRatio ? ` ${body.aspectRatio}` : '';
  return `Create a${duration} ${mode}${aspect}: ${prompt}`;
}

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
  const prompt = body.prompt?.trim() ?? '';
  if (!projectId || !characterId || !prompt) {
    return NextResponse.json({ ok: false, error: 'projectId, characterId and prompt are required' }, { status: 400 });
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

  let cast;
  try {
    cast = await loadDirectorCastRecord(privileged, { projectId, characterId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DIRECTOR_CAST_NOT_FOUND';
    return NextResponse.json({ ok: false, error: message }, { status: message.includes('NOT_FOUND') ? 404 : 409 });
  }

  const { data: bootstrapRow, error: bootstrapError } = await privileged
    .from('director_character_bootstrap_jobs')
    .select('id,bootstrap_plan,status')
    .eq('project_id', projectId)
    .eq('character_id', characterId)
    .in('status', ['reference_locked','ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (bootstrapError) return NextResponse.json({ ok: false, error: bootstrapError.message }, { status: 500 });
  if (!bootstrapRow) {
    return NextResponse.json({ ok: false, error: 'DIRECTOR_CHARACTER_BOOTSTRAP_REQUIRED' }, { status: 409 });
  }

  const bootstrapPlan = bootstrapRow.bootstrap_plan as CharacterReferenceBootstrapPlan;
  const appearanceVariantId = body.appearanceVariantId?.trim() || cast.canonicalAppearanceVariantId;
  let resolved;
  try {
    resolved = resolveCharacterSceneIdentity(cast, {
      projectId,
      characterId,
      continuityRef: cast.continuityRef,
      appearanceVariantId,
      ...(cast.voice ? {
        voiceIdentityId: cast.voice.voiceIdentityId,
        voiceVariantId: cast.voice.defaultVariantId,
        language: cast.voice.primaryLanguage,
      } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_CHARACTER_APPEARANCE_INVALID' },
      { status: 409 },
    );
  }

  const activeTask = buildVideoCommand(body);
  const intent = inspectAskVideoIntent(activeTask);
  if (!intent) return NextResponse.json({ ok: false, error: 'DIRECTOR_VIDEO_INTENT_NOT_DETECTED' }, { status: 400 });

  const dialogueRequired = body.dialogueRequired === true ||
    /\b(dialogue|dialog|conversation|speaks?|talks?|says?|voice acting)\b/i.test(prompt);
  const targetLanguages = [...new Set(
    (body.targetLanguages ?? []).map((language) => language.trim()).filter(Boolean),
  )];

  let productionPlan;
  try {
    productionPlan = planReferenceCharacterVideo({
      id: `reference-video-plan:${crypto.randomUUID()}`,
      projectId,
      prompt,
      intent,
      bootstrapPlan,
      cast,
      defaultAppearanceVariantId: appearanceVariantId,
      dialogueRequired,
      ...(targetLanguages.length ? { targetLanguages } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_REFERENCE_VIDEO_PLAN_INVALID' },
      { status: 409 },
    );
  }

  const referenceResolver = new SupabaseDirectorCharacterReferenceAssetResolver(privileged);
  let referenceUris: string[];
  try {
    referenceUris = await Promise.all(
      resolved.referenceAssetIds.map(async (assetId) => (await referenceResolver.resolve(assetId, projectId)).uri),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'DIRECTOR_CHARACTER_REFERENCE_RESOLUTION_FAILED' },
      { status: 409 },
    );
  }

  const result = await createAndSubmitAskVideoJob({
    userId: user.id,
    activeTask,
    activeProject: projectId,
    clientRequestId: body.clientRequestId,
    referenceCharacter: {
      characterId,
      continuityRef: resolved.continuityRef,
      appearanceVariantId: resolved.sceneAppearanceVariantId,
      characterDescription: resolved.characterDescription,
      appearanceDescription: resolved.appearanceDescription,
      performanceNotes: resolved.performanceNotes,
      referenceAssetIds: [...resolved.referenceAssetIds],
      referenceSha256s: [...resolved.referenceSha256s],
      referenceUris,
      productionPlan,
    },
  });

  const blocked = result.job.status === 'blocked' || result.job.status === 'failed';
  return NextResponse.json({
    ok: !blocked,
    characterId,
    continuityRef: resolved.continuityRef,
    appearanceVariantId: resolved.sceneAppearanceVariantId,
    descriptionRevision: cast.descriptionRevision,
    bootstrapStatus: bootstrapRow.status,
    productionPlan,
    videoJob: result.job,
    ...(blocked ? {
      error: result.job.error,
      requirement: 'Configure a reference-aware Director video provider; generic providers are intentionally excluded.',
    } : {}),
  }, { status: blocked ? 409 : 202 });
}
