import type { SupabaseClient } from '@supabase/supabase-js';

export interface DirectorRuntimeConfig {
  studyWorkerUrl?: string;
  studyCallbackUrl?: string;
  studyWorkerToken?: string;
  certificationVideoProviderUrl?: string;
  certificationVideoProviderToken?: string;
  liveCertificationToken?: string;
  certificationUserId?: string;
}

const KEY_MAP = {
  study_worker_url: 'studyWorkerUrl',
  study_callback_url: 'studyCallbackUrl',
  study_worker_token: 'studyWorkerToken',
  certification_video_provider_url: 'certificationVideoProviderUrl',
  certification_video_provider_token: 'certificationVideoProviderToken',
  live_certification_token: 'liveCertificationToken',
  certification_user_id: 'certificationUserId',
} as const;

export async function loadDirectorRuntimeConfig(
  client: SupabaseClient,
): Promise<DirectorRuntimeConfig> {
  const { data, error } = await client
    .from('director_runtime_config')
    .select('key,value')
    .in('key', Object.keys(KEY_MAP));
  if (error) {
    if (String(error.message).includes('director_runtime_config')) return {};
    throw error;
  }
  const result: Record<string,string> = {};
  for (const row of data ?? []) {
    if (typeof row.key !== 'string' || typeof row.value !== 'string') continue;
    const target = KEY_MAP[row.key as keyof typeof KEY_MAP];
    if (target && row.value.trim()) result[target] = row.value.trim();
  }
  return result as DirectorRuntimeConfig;
}
