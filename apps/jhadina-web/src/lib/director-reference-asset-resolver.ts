import type { SupabaseClient } from '@supabase/supabase-js';
import type { DirectorCharacterReferenceAssetResolver } from '@jhadina/director-core/generation-plan-adapter';

export class SupabaseDirectorReferenceAssetResolver implements DirectorCharacterReferenceAssetResolver {
  constructor(
    private readonly client: SupabaseClient,
    private readonly expectedKind: 'character' | 'product',
    private readonly signedUrlTtlSeconds = 3600,
  ) {}

  async resolve(assetId: string, projectId: string): Promise<{ uri: string; sha256?: string; mimeType?: string }> {
    const { data, error } = await this.client
      .from('director_reference_media_assets')
      .select('id,project_id,bucket_id,object_path,sha256,mime_type,reference_kind,admission_status,scan_status')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .eq('reference_kind', this.expectedKind)
      .maybeSingle();

    if (error) throw new Error(`DIRECTOR_CHARACTER_REFERENCE_READ_FAILED:${error.message}`);
    if (!data) throw new Error('DIRECTOR_CHARACTER_REFERENCE_NOT_FOUND');
    if (data.admission_status !== 'admitted' || data.scan_status !== 'clean') {
      throw new Error('DIRECTOR_CHARACTER_REFERENCE_NOT_ADMITTED');
    }

    const { data: signed, error: signedError } = await this.client.storage
      .from(String(data.bucket_id))
      .createSignedUrl(String(data.object_path), this.signedUrlTtlSeconds);

    if (signedError || !signed?.signedUrl) {
      throw new Error(`DIRECTOR_CHARACTER_REFERENCE_SIGN_FAILED:${signedError?.message ?? 'missing signed URL'}`);
    }

    return {
      uri: signed.signedUrl,
      sha256: String(data.sha256),
      mimeType: String(data.mime_type),
    };
  }
}

export class SupabaseDirectorCharacterReferenceAssetResolver extends SupabaseDirectorReferenceAssetResolver {
  constructor(client: SupabaseClient, signedUrlTtlSeconds = 3600) {
    super(client, 'character', signedUrlTtlSeconds);
  }
}

export class SupabaseDirectorProductReferenceAssetResolver extends SupabaseDirectorReferenceAssetResolver {
  constructor(client: SupabaseClient, signedUrlTtlSeconds = 3600) {
    super(client, 'product', signedUrlTtlSeconds);
  }
}
