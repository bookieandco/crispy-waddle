import type { SupabaseClient } from '@supabase/supabase-js';
import type { GeneratedAssetRecord, GeneratedAssetRepository } from '@jhadina/director-core/generated-asset-resolver';

type AssetRow = {
  id: string;
  project_id: string;
  generation_job_id: string;
  provider_id: string;
  media_type: GeneratedAssetRecord['mediaType'];
  uri: string;
  mime_type: string | null;
  sha256: string | null;
  model_id: string | null;
  workflow_id: string | null;
  workflow_version: number | null;
  loras: GeneratedAssetRecord['loras'] | null;
  prompt: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function toAsset(row: AssetRow): GeneratedAssetRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    generationJobId: row.generation_job_id,
    providerId: row.provider_id,
    mediaType: row.media_type,
    uri: row.uri,
    mimeType: row.mime_type ?? undefined,
    sha256: row.sha256 ?? undefined,
    modelId: row.model_id ?? undefined,
    workflowId: row.workflow_id ?? undefined,
    workflowVersion: row.workflow_version ?? undefined,
    loras: row.loras ?? undefined,
    prompt: row.prompt ?? undefined,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  };
}

export function createSupabaseGeneratedAssetRepository(client: SupabaseClient): GeneratedAssetRepository {
  return {
    async save(asset) {
      const { data, error } = await client.from('director_generated_editing_assets').upsert({
        id: asset.id,
        project_id: asset.projectId,
        generation_job_id: asset.generationJobId,
        provider_id: asset.providerId,
        media_type: asset.mediaType,
        uri: asset.uri,
        mime_type: asset.mimeType ?? null,
        sha256: asset.sha256 ?? null,
        model_id: asset.modelId ?? null,
        workflow_id: asset.workflowId ?? null,
        workflow_version: asset.workflowVersion ?? null,
        loras: asset.loras ?? null,
        prompt: asset.prompt ?? null,
        metadata: asset.metadata ?? {},
        created_at: asset.createdAt,
      }).select('*').single();
      if (error) throw error;
      return toAsset(data as AssetRow);
    },
    async get(id) {
      const { data, error } = await client.from('director_generated_editing_assets').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? toAsset(data as AssetRow) : undefined;
    },
    async listByGenerationJob(generationJobId) {
      const { data, error } = await client.from('director_generated_editing_assets').select('*').eq('generation_job_id', generationJobId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toAsset(row as AssetRow));
    },
    async listByProject(projectId) {
      const { data, error } = await client.from('director_generated_editing_assets').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toAsset(row as AssetRow));
    },
  };
}
