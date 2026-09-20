import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssetProvenanceEvent,
  IntelligenceAssetStore,
  RegisteredIntelligenceAsset,
} from "@jhadina/intelligence-core";

type AssetRow = {
  id: string;
  actor_id: string;
  modality: RegisteredIntelligenceAsset["modality"];
  media_type: string;
  asset_ref: string;
  filename: string | null;
  privacy_class: RegisteredIntelligenceAsset["privacyClass"];
  content_sha256: string | null;
  byte_length: number | null;
  status: "registered";
  created_at: string;
};

function toAsset(row: AssetRow): RegisteredIntelligenceAsset {
  return {
    id: row.id,
    actorId: row.actor_id,
    modality: row.modality,
    mediaType: row.media_type,
    assetRef: row.asset_ref,
    filename: row.filename ?? undefined,
    privacyClass: row.privacy_class,
    contentSha256: row.content_sha256 ?? undefined,
    byteLength: row.byte_length ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

function sameIdentity(a: RegisteredIntelligenceAsset, b: RegisteredIntelligenceAsset): boolean {
  return a.id === b.id &&
    a.actorId === b.actorId &&
    a.modality === b.modality &&
    a.mediaType === b.mediaType &&
    a.assetRef === b.assetRef &&
    (a.filename ?? null) === (b.filename ?? null) &&
    a.privacyClass === b.privacyClass &&
    (a.contentSha256 ?? null) === (b.contentSha256 ?? null) &&
    (a.byteLength ?? null) === (b.byteLength ?? null) &&
    a.status === b.status &&
    a.createdAt === b.createdAt;
}

export class SupabaseIntelligenceAssetStore implements IntelligenceAssetStore {
  constructor(private readonly client: SupabaseClient) {}

  async register(asset: RegisteredIntelligenceAsset): Promise<void> {
    const existing = await this.get(asset.actorId, asset.id);
    if (existing) {
      if (!sameIdentity(existing, asset)) throw new Error("INTELLIGENCE_ASSET_ID_CONFLICT");
      return;
    }

    const { error } = await this.client.from("jhadina_intelligence_assets").insert({
      id: asset.id,
      actor_id: asset.actorId,
      modality: asset.modality,
      media_type: asset.mediaType,
      asset_ref: asset.assetRef,
      filename: asset.filename ?? null,
      privacy_class: asset.privacyClass,
      content_sha256: asset.contentSha256 ?? null,
      byte_length: asset.byteLength ?? null,
      status: asset.status,
      created_at: asset.createdAt,
    });
    if (error) throw error;
  }

  async get(actorId: string, assetId: string): Promise<RegisteredIntelligenceAsset | undefined> {
    const { data, error } = await this.client
      .from("jhadina_intelligence_assets")
      .select("*")
      .eq("id", assetId)
      .eq("actor_id", actorId)
      .maybeSingle();
    if (error) throw error;
    return data ? toAsset(data as AssetRow) : undefined;
  }

  async appendProvenance(event: AssetProvenanceEvent): Promise<void> {
    const { error } = await this.client
      .from("jhadina_intelligence_asset_provenance")
      .upsert({
        asset_id: event.assetId,
        actor_id: event.actorId,
        type: event.type,
        occurred_at: event.at,
        content_sha256: event.contentSha256 ?? null,
      }, { onConflict: "asset_id,type", ignoreDuplicates: true });
    if (error) throw error;
  }
}
