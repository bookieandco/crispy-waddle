// lib/muapi.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.MUAPI_API_KEY, which must never reach the browser.
//
// Second image-generation provider, alongside lib/ai.ts's OpenAI path —
// not a replacement. Muapi.ai (https://muapi.ai) is a hosted proxy in
// front of ~70 third-party image models (Flux, Nano Banana/Gemini, GPT
// image, Qwen, Midjourney, etc.), used here for two style options
// OpenAI's gpt-image-1 doesn't give a clean way to reproduce: a
// purpose-built fixed style-transfer tool (Ghibli) and a distinct
// prompt-driven restyle model (Flux Kontext) for variety.
//
// Muapi.ai's own docs domain (muapi.ai, docs.muapi.ai) is blocked by
// this environment's egress policy — every detail below (endpoints, auth
// header, request/response shapes) was verified instead against
// Anil-matcha/Open-Generative-AI's actual working client source
// (packages/studio/src/muapi.js, models.js), which is real running code,
// not documentation that might be stale. Two things that source
// genuinely could NOT establish (not present in the client, and the
// pricing/rate-limit doc pages were unreachable to check directly):
// exact pricing per model, and any documented rate limit. Neither
// blocks correctness here — just worth knowing before assuming a cost
// or throughput budget.
//
// UNTESTED against a live key, same honest caveat as every other AI
// integration in this project (lib/ai.ts, lib/animation.ts) — no network
// access to muapi.ai from the sandbox that wrote this. Treat the first
// real run as a test: confirm the response shapes below still match
// Muapi's current API before trusting this in production.

const BASE_URL = "https://api.muapi.ai";

/** Registered subset of Muapi's ~70 image-to-image models — not the full
 * catalog, just the ones actually wired to an art style below. Each
 * model's JSON body shape differs (which field carries the image, and
 * whether it accepts a prompt at all), per Open-Generative-AI's models.js. */
export interface MuapiModel {
  /** the endpoint path segment: POST /api/v1/{endpoint} */
  endpoint: string;
  /** which JSON field carries the input image URL */
  imageField: "image_url" | "images_list";
  /** false for fixed-effect tools (e.g. ai-ghibli-style) that ignore any prompt */
  hasPrompt: boolean;
}

export const MUAPI_MODELS: Record<string, MuapiModel> = {
  "ai-ghibli-style": {
    endpoint: "ai-ghibli-style",
    imageField: "image_url",
    hasPrompt: false,
  },
  "flux-kontext-pro-i2i": {
    endpoint: "flux-kontext-pro-i2i",
    imageField: "images_list",
    hasPrompt: true,
  },
};

export interface GenerateWithMuapiParams {
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: string;
  /** key into MUAPI_MODELS */
  model: keyof typeof MUAPI_MODELS;
  /** ignored if the model's hasPrompt is false */
  prompt?: string;
}

export interface MuapiResult {
  success: true;
  imageBase64: string;
}

export interface MuapiError {
  success: false;
  error: string;
}

function requireApiKey(): string | MuapiError {
  const key = process.env.MUAPI_API_KEY;
  if (!key) {
    return { success: false, error: "MUAPI_API_KEY is not configured." };
  }
  return key;
}

/** POST /api/v1/upload_file — multipart, returns a URL Muapi can use as
 * an input elsewhere. Response shape isn't fully consistent across
 * Muapi's own surface per the reference client, hence checking three
 * possible field names rather than trusting one. */
async function uploadFile(
  apiKey: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const res = await fetch(`${BASE_URL}/api/v1/upload_file`, {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Muapi upload failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    url?: string;
    file_url?: string;
    data?: { url?: string };
  };
  const url = data.url || data.file_url || data.data?.url;
  if (!url) {
    throw new Error("Muapi upload response did not include a file URL.");
  }
  return url;
}

/** POST /api/v1/{endpoint} — submits the generation job, returns a
 * request_id to poll. Auth is the `x-api-key` header, NOT `Authorization:
 * Bearer` — confirmed from the reference client, not the more common
 * convention you'd otherwise assume. */
async function submitJob(
  apiKey: string,
  model: MuapiModel,
  imageUrl: string,
  prompt: string | undefined
): Promise<string> {
  const body: Record<string, unknown> = {};
  if (model.hasPrompt && prompt) body.prompt = prompt;
  if (model.imageField === "images_list") body.images_list = [imageUrl];
  else body.image_url = imageUrl;

  const res = await fetch(`${BASE_URL}/api/v1/${model.endpoint}`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Muapi submit failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { request_id?: string; id?: string };
  const requestId = data.request_id || data.id;
  if (!requestId) {
    throw new Error("Muapi submit response did not include a request_id.");
  }
  return requestId;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 2 minutes — a still-image edit, not a video job

/** GET /api/v1/predictions/{request_id}/result — polled until a terminal
 * status. The reference client is deliberately status-agnostic for the
 * "still working" case (any status besides the completed/failed sets
 * below just means "keep polling") because Muapi doesn't document a
 * fixed list of in-progress status strings — matched here for the same
 * reason, not simplified away. */
async function pollResult(apiKey: string, requestId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await fetch(`${BASE_URL}/api/v1/predictions/${requestId}/result`, {
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        error?: string;
        outputs?: string[];
        url?: string;
        output?: { url?: string };
      };
      const status = data.status?.toLowerCase();

      if (status === "completed" || status === "succeeded" || status === "success") {
        const outputUrl = data.outputs?.[0] || data.url || data.output?.url;
        if (!outputUrl) {
          throw new Error("Muapi result was completed but had no output URL.");
        }
        return outputUrl;
      }
      if (status === "failed" || status === "error") {
        throw new Error(`Muapi generation failed: ${data.error || "Unknown error"}`);
      }
      // else: still processing, fall through to the delay below
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Muapi generation timed out after ${(MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s.`
  );
}

/**
 * Full pipeline: upload the pet photo, submit the chosen model, poll for
 * the result, then fetch the finished image and re-encode it as base64 —
 * matching lib/ai.ts's GenerateArtResult shape exactly, so the API route
 * can treat both providers identically regardless of which one a given
 * art style routes to.
 */
export async function generateWithMuapi(
  params: GenerateWithMuapiParams
): Promise<MuapiResult | MuapiError> {
  const apiKey = requireApiKey();
  if (typeof apiKey !== "string") return apiKey;

  const model = MUAPI_MODELS[params.model];
  if (!model) {
    return { success: false, error: `Unknown Muapi model: ${params.model}` };
  }

  try {
    const inputUrl = await uploadFile(
      apiKey,
      params.imageBuffer,
      params.imageFilename,
      params.imageMimeType
    );
    const requestId = await submitJob(apiKey, model, inputUrl, params.prompt);
    const outputUrl = await pollResult(apiKey, requestId);

    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) {
      return {
        success: false,
        error: `Failed to fetch generated image: ${imageRes.status}`,
      };
    }
    const imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");

    return { success: true, imageBase64 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling Muapi.",
    };
  }
}
