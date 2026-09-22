import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  detectAskVideoCreationIntent,
  type AskVideoCreationIntent,
  type DirectorVideoJob,
} from '@jhadina/director-core/ask-video-production';
import {
  mapWholeVideoProviderStatus,
  selectWholeVideoProvider,
  type WholeVideoReferenceCharacter,
} from '@jhadina/director-core/whole-video-provider';
import {
  resolveCharacterSceneIdentity,
  validateCharacterCastRecord,
  type CharacterCastRecord,
} from '@jhadina/director-core';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createConfiguredWholeVideoProviders } from '@/lib/director-whole-video-providers';

type VideoJobRow = {
  id: string;
  client_request_id: string;
  user_id: string;
  project_id: string;
  production_run_id: string;
  source: 'ask-jhadina';
  prompt: string;
  mode: DirectorVideoJob['mode'];
  aspect_ratio: DirectorVideoJob['aspectRatio'];
  target_duration_seconds: number | null;
  status: DirectorVideoJob['status'];
  current_phase: string;
  provider_id: string | null;
  provider_job_id: string | null;
  output_asset_ids: string[] | null;
  preview_asset_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function toJob(row: VideoJobRow): DirectorVideoJob {
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    userId: row.user_id,
    projectId: row.project_id,
    productionRunId: row.production_run_id,
    source: row.source,
    prompt: row.prompt,
    mode: row.mode,
    aspectRatio: row.aspect_ratio,
    ...(row.target_duration_seconds !== null ? { targetDurationSeconds: Number(row.target_duration_seconds) } : {}),
    status: row.status,
    currentPhase: row.current_phase,
    ...(row.provider_id ? { providerId: row.provider_id } : {}),
    ...(row.provider_job_id ? { providerJobId: row.provider_job_id } : {}),
    outputAssetIds: row.output_asset_ids ?? [],
    ...(row.preview_asset_id ? { previewAssetId: row.preview_asset_id } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function updateJob(
  client: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
): Promise<DirectorVideoJob> {
  const { data, error } = await client
    .from('director_video_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('*')
    .single();
  if (error) throw error;
  return toJob(data as VideoJobRow);
}

async function appendJobEvent(
  client: SupabaseClient,
  input: {
    jobId: string;
    eventType: string;
    status: string;
    providerId?: string;
    providerJobId?: string;
    metadata?: Record<string, unknown>;
    error?: string;
  },
): Promise<void> {
  const { error } = await client.from('director_video_job_events').insert({
    job_id: input.jobId,
    event_type: input.eventType,
    status: input.status,
    provider_id: input.providerId ?? null,
    provider_job_id: input.providerJobId ?? null,
    metadata: input.metadata ?? {},
    error: input.error ?? null,
  });
  if (error) throw error;
}

export interface AskVideoReferenceCharacterInput {
  characterId: string;
  appearanceVariantId?: string;
  targetLanguages?: readonly string[];
}

export interface AskVideoJobInput {
  userId: string;
  activeTask: string;
  activeProject?: string;
  clientRequestId?: string;
  referenceCharacters?: readonly AskVideoReferenceCharacterInput[];
}

export interface AskVideoJobResult {
  intent: AskVideoCreationIntent;
  job: DirectorVideoJob;
}

export function inspectAskVideoIntent(activeTask: string): AskVideoCreationIntent | undefined {
  return detectAskVideoCreationIntent(activeTask);
}

async function resolveReferenceCharacters(
  client: SupabaseClient,
  projectId: string,
  requested: readonly AskVideoReferenceCharacterInput[],
): Promise<WholeVideoReferenceCharacter[]> {
  const resolved: WholeVideoReferenceCharacter[] = [];
  for (const item of requested) {
    const characterId = item.characterId.trim();
    if (!characterId) throw new Error('DIRECTOR_REFERENCE_CHARACTER_ID_REQUIRED');

    const { data, error } = await client
      .from('director_cast_records')
      .select('cast_record')
      .eq('project_id', projectId)
      .eq('character_id', characterId)
      .maybeSingle();
    if (error) throw new Error(`DIRECTOR_CAST_READ_FAILED:${error.message}`);
    if (!data?.cast_record) throw new Error(`DIRECTOR_CAST_NOT_FOUND:${characterId}`);

    const cast = data.cast_record as CharacterCastRecord;
    const castErrors = validateCharacterCastRecord(cast);
    if (castErrors.length) throw new Error(`DIRECTOR_CAST_INVALID:${castErrors.join(';')}`);
    if (cast.projectId !== projectId || cast.characterId !== characterId) {
      throw new Error('DIRECTOR_CAST_ROW_IDENTITY_MISMATCH');
    }

    const appearanceVariantId = item.appearanceVariantId?.trim() || cast.canonicalAppearanceVariantId;
    const identity = resolveCharacterSceneIdentity(cast, {
      projectId,
      characterId,
      continuityRef: cast.continuityRef,
      appearanceVariantId,
    });

    resolved.push({
      characterId,
      continuityRef: identity.continuityRef,
      appearanceVariantId: identity.sceneAppearanceVariantId,
      referenceAssetIds: identity.referenceAssetIds,
      ...(item.targetLanguages?.length
        ? { targetLanguages: [...new Set(item.targetLanguages.map((value) => value.trim()).filter(Boolean))] }
        : {}),
    });
  }
  return resolved;
}

export async function createAndSubmitAskVideoJob(input: AskVideoJobInput): Promise<AskVideoJobResult> {
  const intent = detectAskVideoCreationIntent(input.activeTask);
  if (!intent) throw new Error('DIRECTOR_VIDEO_INTENT_NOT_DETECTED');

  const client = createServiceRoleClient();
  if (!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');

  const clientRequestId = input.clientRequestId?.trim() || randomUUID();
  const jobId = `video:${randomUUID()}`;
  const existingProject = input.activeProject?.trim();
  if (input.referenceCharacters?.length && !existingProject) {
    throw new Error('DIRECTOR_REFERENCE_CHARACTER_PROJECT_REQUIRED');
  }
  const projectId = existingProject || `director:ask:${jobId}`;
  const resolvedReferenceCharacters = input.referenceCharacters?.length
    ? await resolveReferenceCharacters(client, projectId, input.referenceCharacters)
    : [];
  const now = new Date().toISOString();

  const { data, error } = await client.rpc('create_director_video_job', {
    p_job_id: jobId,
    p_client_request_id: clientRequestId,
    p_user_id: input.userId,
    p_project_id: projectId,
    p_create_project: !existingProject,
    p_prompt: intent.prompt,
    p_mode: intent.mode,
    p_aspect_ratio: intent.aspectRatio,
    p_target_duration_seconds: intent.targetDurationSeconds ?? null,
    p_spec: {
      narration: intent.narration,
      captions: intent.captions,
      foley: intent.foley,
      commercialSafeOnly: intent.commercialSafeOnly,
      referenceCharacters: resolvedReferenceCharacters,
    },
    p_provider_policy: intent.providerPolicy,
    p_now: now,
  });
  if (error) throw error;

  let job = toJob(data as VideoJobRow);
  if (job.providerJobId || ['submitted','generating','ingesting','preview_ready'].includes(job.status)) {
    return { intent, job };
  }

  const provider = selectWholeVideoProvider(createConfiguredWholeVideoProviders(), intent, {
    referenceCharacterCount: resolvedReferenceCharacters.length,
  });
  if (!provider) {
    const providerError = resolvedReferenceCharacters.length
      ? 'DIRECTOR_REFERENCE_CHARACTER_PROVIDER_NOT_CONFIGURED'
      : 'DIRECTOR_VIDEO_PROVIDER_NOT_CONFIGURED';
    job = await updateJob(client, job.id, {
      status: 'blocked',
      current_phase: 'provider-selection',
      error: providerError,
    });
    await appendJobEvent(client, {
      jobId: job.id,
      eventType: 'provider_selection',
      status: 'blocked',
      error: providerError,
      metadata: resolvedReferenceCharacters.length
        ? { requiredReferenceCharacters: resolvedReferenceCharacters.map((item) => item.characterId) }
        : undefined,
    });
    return { intent, job };
  }

  job = await updateJob(client, job.id, {
    provider_id: provider.descriptor.id,
    submission_state: 'submitting',
    current_phase: 'provider-submission',
    error: null,
  });
  await appendJobEvent(client, {
    jobId: job.id,
    eventType: 'submission_started',
    status: 'running',
    providerId: provider.descriptor.id,
  });

  try {
    const result = await provider.submit({
      jobId: job.id,
      projectId: job.projectId,
      prompt: job.prompt,
      intent,
      creativeName: `Jhadina ${job.id.slice(-8)}`,
      ...(resolvedReferenceCharacters.length
        ? { referenceCharacters: resolvedReferenceCharacters }
        : {}),
    }, `director-video:${job.id}`);

    job = await updateJob(client, job.id, {
      status: mapWholeVideoProviderStatus(result),
      current_phase: 'generation',
      provider_job_id: result.providerJobId,
      submission_state: 'submitted',
      error: null,
    });

    const { error: runError } = await client
      .from('director_production_runs')
      .update({ status: 'executing', updated_at: new Date().toISOString() })
      .eq('id', job.productionRunId)
      .eq('project_id', job.projectId);
    if (runError) throw runError;

    await appendJobEvent(client, {
      jobId: job.id,
      eventType: 'provider_submitted',
      status: job.status,
      providerId: provider.descriptor.id,
      providerJobId: result.providerJobId,
      metadata: result.metadata ? { provider: result.metadata } : undefined,
    });
    return { intent, job };
  } catch (cause) {
    const errorCode = cause instanceof Error ? cause.message : 'DIRECTOR_VIDEO_PROVIDER_SUBMISSION_FAILED';
    // These provider APIs do not expose idempotency lookup. A response failure
    // after POST may be ambiguous, so never auto-retry and risk duplicate spend/work.
    job = await updateJob(client, job.id, {
      status: 'blocked',
      submission_state: 'uncertain',
      current_phase: 'submission-reconciliation',
      error: 'DIRECTOR_VIDEO_SUBMISSION_UNCERTAIN',
    });
    await appendJobEvent(client, {
      jobId: job.id,
      eventType: 'provider_submission_uncertain',
      status: 'blocked',
      providerId: provider.descriptor.id,
      error: errorCode,
    });
    return { intent, job };
  }
}

export async function getAskVideoJobForUser(
  userId: string,
  jobId: string,
): Promise<DirectorVideoJob | undefined> {
  const client = createServiceRoleClient();
  if (!client) throw new Error('DIRECTOR_SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');

  const { data, error } = await client
    .from('director_video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toJob(data as VideoJobRow) : undefined;
}
