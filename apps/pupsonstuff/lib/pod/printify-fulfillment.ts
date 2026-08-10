import type { SupabaseClient } from "@supabase/supabase-js";
import { PrintifyProvider } from "./printify";

export type FulfillmentInput = {
  jobId: string;
  creationId: string;
  externalProductId: string;
  variantId: string;
  quantity: number;
  artworkUrl: string;
};

export function assertFulfillmentGate(input: { customerApproved: boolean; productionReady: boolean; qualityScore?: number }) {
  if (!input.customerApproved) throw new Error("Customer approval is required before fulfillment.");
  if (!input.productionReady) throw new Error("Production artwork is not ready.");
  if ((input.qualityScore ?? 0) < 90) throw new Error("Production quality score is below the fulfillment threshold.");
}

export async function preparePrintifyFulfillment(supabase: SupabaseClient, config: { apiKey: string; shopId: string }, input: FulfillmentInput) {
  const provider = new PrintifyProvider(config);
  const draft = provider.buildOrderDraft({ externalProductId: input.externalProductId, variantId: input.variantId, quantity: input.quantity, artworkUrl: input.artworkUrl });
  const { data, error } = await supabase.from("pupson_pod_jobs").update({ stage: "provider_upload", status: "queued", provider: "printify", last_error: null }).eq("id", input.jobId).eq("creation_id", input.creationId).select("id,creation_id,stage,status,attempts,last_error,updated_at").single();
  if (error) throw error;
  return { job: data, draft };
}
