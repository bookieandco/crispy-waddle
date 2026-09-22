import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GenerationReferenceUriResolver,
  ResolvedGenerationReference,
} from '@jhadina/director-core';

/**
 * Resolves stable Director reference-media IDs into short-lived URLs only at
 * the external provider submission boundary.
 */
export class SupabaseDirectorReferenceUriResolver implements GenerationReferenceUriResolver {
  constructor(
    private readonly client: SupabaseClient,
    private readonly signedUrlSeconds = 300,
  ) {}

  async resolve(input: {
    projectId: string;
    assetId: string;
    role: 'character' | 'location' | 'style' | 'composition' | 'motion' | 'image';
  }): Promise<ResolvedGenerationReference | undefined> {
    const { data, error } = await this.client
      .from('director_reference_media')
      .select('id,project_id,object_path,normalized_sha256,admission_status')
      .eq('id', input.assetId)
      .eq('project_id', input.projectId)
      .eq('admission_status', 'admitted')
      .maybeSingle();

    if (error) throw new Error(`DIRECTOR_REFERENCE_URI_READ_FAILED:${error.message}`);
    if (!data) return undefined;

    const { data: signed, error: signedError } = await this.client.storage
      .from('director-media')
      .createSignedUrl(String(data.object_path), this.signedUrlSeconds);
    if (signedError || !signed?.signedUrl) {
      throw new Error(`DIRECTOR_REFERENCE_URI_SIGN_FAILED:${signedError?.message ?? 'missing signed URL'}`);
    }

    return {
      assetId: String(data.id),
      uri: signed.signedUrl,
      sha256: String(data.normalized_sha256),
    };
  }
}
