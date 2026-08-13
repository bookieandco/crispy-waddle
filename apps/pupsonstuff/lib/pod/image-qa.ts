export type ImageQaInput = { width?: number; height?: number; mimeType?: string; fileSizeBytes?: number };
export type ImageQaResult = { score: number; productionReady: boolean; reasons: string[] };

const MIN_DIMENSION = 1600;
const MIN_SCORE = 90;

/**
 * Deterministic pre-production artwork check. Pure — no I/O.
 *
 * The Supabase-backed orchestration this originally shipped with
 * (`runArtworkQa`, writing to `pupson_pod_jobs`/`pupson_creation_assets`)
 * is deliberately not included here: those tables have no migration
 * anywhere in this repo, so that half can't be verified end-to-end. Land
 * it alongside whichever schema/Printify-integration decision covers the
 * rest of the POD pipeline, not as a speculative dependency here.
 */
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
