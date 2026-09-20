import type { SupabaseClient } from "@supabase/supabase-js";
import { JHADINA_INTAKE_BUCKET } from "./supabase-universal-upload-store";

export interface TrustedAssetReadResolver {
  signedReadUrl(input: {
    actorId: string;
    assetRef: string;
  }): Promise<string>;
}

function parseSupabaseRef(assetRef: string): { bucket: string; path: string } {
  const match = /^supabase:\/\/([^/]+)\/(.+)$/.exec(assetRef);
  if (!match) throw new Error("PERCEPTION_ASSET_REFERENCE_INVALID");
  return { bucket: match[1], path: match[2] };
}

/**
 * Resolves only actor-scoped objects already promoted into trusted storage.
 * Quarantine objects can never be handed to perception workers.
 */
export class SupabaseTrustedAssetReadResolver implements TrustedAssetReadResolver {
  constructor(
    private readonly client: SupabaseClient,
    private readonly signedUrlTtlSeconds = 300,
  ) {}

  async signedReadUrl(input: {
    actorId: string;
    assetRef: string;
  }): Promise<string> {
    if (!input.actorId.trim()) throw new Error("PERCEPTION_ACTOR_REQUIRED");
    const parsed = parseSupabaseRef(input.assetRef);
    if (parsed.bucket !== JHADINA_INTAKE_BUCKET) {
      throw new Error("PERCEPTION_ASSET_BUCKET_NOT_ALLOWED");
    }
    if (!parsed.path.startsWith(`trusted/${input.actorId}/`)) {
      throw new Error("PERCEPTION_ASSET_SCOPE_MISMATCH");
    }

    const { data, error } = await this.client.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, this.signedUrlTtlSeconds);
    if (error || !data?.signedUrl) {
      throw error ?? new Error("PERCEPTION_SIGNED_URL_UNAVAILABLE");
    }
    return data.signedUrl;
  }
}
