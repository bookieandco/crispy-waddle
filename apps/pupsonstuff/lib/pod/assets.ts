import type { SupabaseClient } from "@supabase/supabase-js";

export type CreationAssetKind = "original-photo" | "ai-artwork" | "production-artwork" | "proof";

export async function addCreationAsset(supabase: SupabaseClient, input: {
  creationId: string;
  kind: CreationAssetKind;
  storagePath?: string;
  publicUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}) {
  const { data, error } = await supabase.from("pupson_creation_assets").insert({
    creation_id: input.creationId,
    kind: input.kind,
    storage_path: input.storagePath ?? null,
    public_url: input.publicUrl ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    mime_type: input.mimeType ?? null,
  }).select("id,creation_id,kind,storage_path,public_url,width,height,mime_type,quality_score,production_ready,created_at").single();
  if (error) throw error;
  return data;
}
