import type { SupabaseClient } from "@supabase/supabase-js";
import { addCreationAsset } from "./assets";

export type AiCustomizationRequest = {
  creationId: string;
  sourceAssetId: string;
  style: string;
  prompt?: string;
};

export async function queueAiCustomization(supabase: SupabaseClient, input: AiCustomizationRequest) {
  const { data: asset, error: assetError } = await supabase.from("pupson_creation_assets").select("id,creation_id,kind,storage_path,public_url").eq("id", input.sourceAssetId).eq("creation_id", input.creationId).single();
  if (assetError) throw assetError;
  if (asset.kind !== "original-photo") throw new Error("AI customization requires an original pet photo asset.");

  const { data: job, error: jobError } = await supabase.from("pupson_pod_jobs").update({ stage: "ai_generation", status: "queued", last_error: null }).eq("creation_id", input.creationId).eq("stage", "photo_received").select("id,creation_id,stage,status,attempts,last_error,updated_at").single();
  if (jobError) throw jobError;

  return { job, sourceAsset: asset, style: input.style, prompt: input.prompt ?? "" };
}

export async function registerAiArtwork(supabase: SupabaseClient, input: { creationId: string; publicUrl?: string; storagePath?: string; width?: number; height?: number; mimeType?: string }) {
  return addCreationAsset(supabase, { ...input, kind: "ai-artwork" });
}
