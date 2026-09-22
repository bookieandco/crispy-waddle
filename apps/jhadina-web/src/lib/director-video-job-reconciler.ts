import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DirectorVideoJob } from '@jhadina/director-core/ask-video-production';
import { createSupabaseGeneratedAssetRepository } from '@/lib/supabase-generated-asset-repository';
import { createConfiguredWholeVideoProviders } from '@/lib/director-whole-video-providers';

type JobRow = {
  id: string;
  user_id: string;
  project_id: string;
  production_run_id: string;
  prompt: string;
  status: DirectorVideoJob['status'];
  provider_id: string | null;
  provider_job_id: string | null;
  submission_state: string;
  output_asset_ids: string[] | null;
  preview_asset_id: string | null;
  spec: Record<string, unknown> | null;
  updated_at: string;
};

export interface DirectorVideoReconciliationSummary {
  inspected: number;
  advanced: number;
  completed: number;
  failed: number;
  blocked: number;
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function event(
  client: SupabaseClient,
  job: JobRow,
  eventType: string,
  status: string,
  metadata: Record<string, unknown> = {},
  error?: string,
): Promise<void> {
  const { error: insertError } = await client.from('director_video_job_events').insert({
    job_id: job.id,
    event_type: eventType,
    status,
    provider_id: job.provider_id,
    provider_job_id: job.provider_job_id,
    metadata,
    error: error ?? null,
  });
  if (insertError) throw insertError;
}

async function patch(
  client: SupabaseClient,
  jobId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await client
    .from('director_video_jobs')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', jobId);
  if (error) throw error;
}

async function failRun(client: SupabaseClient, job: JobRow, message: string): Promise<void> {
  await patch(client, job.id, { status: 'failed', current_phase: 'failed', error: message });
  await client.from('director_production_runs')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('id', job.production_run_id)
    .eq('project_id', job.project_id);
  await event(client, job, 'failed', 'failed', {}, message);
}

export async function reconcileDirectorVideoJobs(
  client: SupabaseClient,
  options: { limit?: number } = {},
): Promise<DirectorVideoReconciliationSummary> {
  const limit = Math.max(1, Math.min(25, options.limit ?? 5));
  const { data, error } = await client
    .from('director_video_jobs')
    .select('id,user_id,project_id,production_run_id,prompt,status,provider_id,provider_job_id,submission_state,output_asset_ids,preview_asset_id,spec,updated_at')
    .in('status', ['submitted','generating','ingesting'])
    .order('updated_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const providers = new Map(createConfiguredWholeVideoProviders().map((provider) => [provider.descriptor.id, provider]));
  const assets = createSupabaseGeneratedAssetRepository(client);
  const summary: DirectorVideoReconciliationSummary = { inspected: 0, advanced: 0, completed: 0, failed: 0, blocked: 0 };

  for (const raw of data ?? []) {
    const job = raw as JobRow;
    summary.inspected += 1;
    try {
      if (!job.provider_id || !job.provider_job_id) {
        await patch(client, job.id, {
          status: 'blocked',
          current_phase: 'provider-reconciliation',
          error: 'DIRECTOR_VIDEO_PROVIDER_RECEIPT_MISSING',
        });
        await event(client, job, 'provider_receipt_missing', 'blocked');
        summary.blocked += 1;
        continue;
      }

      const provider = providers.get(job.provider_id);
      if (!provider) {
        await patch(client, job.id, {
          status: 'blocked',
          current_phase: 'provider-reconciliation',
          error: 'DIRECTOR_VIDEO_PROVIDER_NOT_CONFIGURED',
        });
        await event(client, job, 'provider_unavailable', 'blocked');
        summary.blocked += 1;
        continue;
      }

      if (job.status !== 'ingesting') {
        const providerState = await provider.status(job.provider_job_id);
        if (providerState.status === 'failed') {
          await failRun(client, job, providerState.error ?? 'DIRECTOR_VIDEO_PROVIDER_FAILED');
          summary.failed += 1;
          continue;
        }
        if (providerState.status !== 'ready') {
          const nextStatus = providerState.status === 'queued' ? 'submitted' : 'generating';
          await patch(client, job.id, {
            status: nextStatus,
            current_phase: 'generation',
            error: null,
          });
          summary.advanced += 1;
          continue;
        }
        await patch(client, job.id, {
          status: 'ingesting',
          current_phase: 'ingest',
          error: null,
        });
        await event(client, job, 'provider_ready', 'ingesting', { resultUri: providerState.resultUri ?? null });
        summary.advanced += 1;
      }

      const media = await provider.download(job.provider_job_id);
      if (!media.bytes.byteLength) throw new Error('DIRECTOR_VIDEO_EMPTY_OUTPUT');
      if (media.bytes.byteLength > 536_870_912) throw new Error('DIRECTOR_VIDEO_OUTPUT_TOO_LARGE');
      if (!media.contentType.toLowerCase().includes('video')) throw new Error('DIRECTOR_VIDEO_OUTPUT_MIME_INVALID');

      const sha256 = createHash('sha256').update(media.bytes).digest('hex');
      const assetId = `${job.id}:final`;
      const objectPath = [
        safePathSegment(job.user_id),
        safePathSegment(job.project_id),
        safePathSegment(job.id),
        'final.mp4',
      ].join('/');

      const { error: uploadError } = await client.storage
        .from('director-media')
        .upload(objectPath, media.bytes, {
          contentType: media.contentType,
          upsert: false,
        });
      if (uploadError && !String(uploadError.message).toLowerCase().includes('already exists')) {
        throw uploadError;
      }

      const storageUri = `storage://director-media/${objectPath}`;
      await assets.save({
        id: assetId,
        projectId: job.project_id,
        generationJobId: job.id,
        providerId: job.provider_id,
        mediaType: 'video',
        uri: storageUri,
        mimeType: media.contentType,
        sha256,
        prompt: job.prompt,
        approvalPolicy: 'standard',
        createdAt: new Date().toISOString(),
        metadata: {
          source: 'ask-jhadina',
          providerJobId: job.provider_job_id,
          privateBucket: 'director-media',
          objectPath,
          ffmpegQc: 'pending-runtime-inspection',
          ...(job.spec?.referenceCharacter && typeof job.spec.referenceCharacter === 'object'
            ? { referenceCharacter: job.spec.referenceCharacter }
            : {}),
        },
      });

      await patch(client, job.id, {
        status: 'preview_ready',
        current_phase: 'review',
        submission_state: 'completed',
        output_asset_ids: [assetId],
        preview_asset_id: assetId,
        error: null,
      });
      await client.from('director_production_runs')
        .update({ status: 'review', updated_at: new Date().toISOString() })
        .eq('id', job.production_run_id)
        .eq('project_id', job.project_id);
      await client.from('director_creative_stages')
        .update({ status: 'review', output_artifact_ids: [assetId], updated_at: new Date().toISOString() })
        .eq('project_id', job.project_id)
        .in('kind', ['generation','edit','review']);

      await event(client, job, 'preview_ready', 'preview_ready', { assetId, sha256 });
      summary.completed += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'DIRECTOR_VIDEO_RECONCILIATION_FAILED';
      await failRun(client, job, message);
      summary.failed += 1;
    }
  }

  return summary;
}
