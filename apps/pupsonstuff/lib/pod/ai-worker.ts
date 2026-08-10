import type { SupabaseClient } from "@supabase/supabase-js";
import { registerAiArtwork } from "./ai-job";

export type AiImageProvider = {
  generate(input: { sourceUrl: string; style: string; prompt?: string }): Promise<{ url: string; width?: number; height?: number; mimeType?: string }>;
};

export async function runAiCustomizationJob(supabase: SupabaseClient, provider: AiImageProvider, input: { jobId: string; creationId: string; sourceUrl: string; style: string; prompt?: string }) {
  await supabase.from("pupson_pod_jobs").update({ status: "running", last_error: null }).eq("id", input.jobId);
  try {
    const result = await provider.generate({ sourceUrl: input.sourceUrl, style: input.style, prompt: input.prompt });
    const asset = await registerAiArtwork(supabase, { creationId: input.creationId, publicUrl: result.url, width: result.width, height: result.height, mimeType: result.mimeType });
    const { data: job, error } = await supabase.from("pupson_pod_jobs").update({ stage: "artwork_qa", status: "queued", last_error: null }).eq("id", input.jobId).select("id,creation_id,stage,status,attempts,last_error,updated_at").single();
    if (error) throw error;
    return { job, asset };
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    await supabase.from("pupson_pod_jobs").update({ status: "failed", attempts: input.jobId ? undefined : 0, last_error: message }).eq("id", input.jobId);
    throw error;
  }
}
