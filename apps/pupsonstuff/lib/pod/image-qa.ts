import type { SupabaseClient } from "@supabase/supabase-js";

export type ImageQaInput = { width?: number; height?: number; mimeType?: string; fileSizeBytes?: number };
export type ImageQaResult = { score: number; productionReady: boolean; reasons: string[] };

const MIN_DIMENSION = 1600;
const MIN_SCORE = 90;

export function evaluateArtwork(input: ImageQaInput): ImageQaResult {
  const reasons: string[] = [];
  let score = 100;
  const width = input.width ?? 0;
  const height = input.height ?? 0;
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) { score -= 35; reasons.push("Artwork is below the minimum 1600px production dimension."); }
  if (input.mimeType && !["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) { score -= 25; reasons.push("Unsupported production image format."); }
  if (input.fileSizeBytes && input.fileSizeBytes > 25 * 1024 * 1024) { score -= 10; reasons.push("Artwork exceeds the 25MB production review limit."); }
  return { score: Math.max(0, score), productionReady: score >= MIN_SCORE, reasons };
}

export async function runArtworkQa(supabase: SupabaseClient, input: { creationId: string; assetId: string; width?: number; height?: number; mimeType?: string; fileSizeBytes?: number }) {
  const result = evaluateArtwork(input);
  const { error: assetError } = await supabase.from("pupson_creation_assets").update({ quality_score: result.score, production_ready: result.productionReady }).eq("id", input.assetId).eq("creation_id", input.creationId);
  if (assetError) throw assetError;
  const next = result.productionReady ? "print_composition" : "ai_generation";
  const status = result.productionReady ? "queued" : "failed";
  const lastError = result.productionReady ? null : result.reasons.join(" ");
  const { data, error } = await supabase.from("pupson_pod_jobs").update({ stage: next, status, last_error: lastError }).eq("creation_id", input.creationId).eq("stage", "artwork_qa").select("id,creation_id,stage,status,attempts,last_error,updated_at").single();
  if (error) throw error;
  return { result, job: data };
}
