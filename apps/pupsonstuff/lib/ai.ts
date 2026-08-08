// lib/ai.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.OPENAI_API_KEY, which must never reach the browser.

import OpenAI, { toFile } from "openai";

export interface GenerateArtParams {
  /** the pet photo, as a Buffer read from the incoming request */
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: string;
  /** base template from the master prompt, e.g. from AI_PROMPT_TEMPLATE below */
  basePrompt: string;
  /** hotspot.aiTemplate — the product-specific addition, see data/hotspots.ts */
  productPrompt?: string;
  artStyleLabel: string;
}

export const AI_PROMPT_TEMPLATE = `Create a premium pet portrait using the selected art style.
Maintain the pet's exact facial markings.
Maintain eye color.
Maintain fur pattern.
Do not change breed.
Center the composition.
Square format.
Print quality.
Neutral background.
Luxury pet artwork.`;

export interface GenerateArtResult {
  success: true;
  imageBase64: string;
}

export interface GenerateArtError {
  success: false;
  error: string;
}

// Lazily constructed — reading process.env.OPENAI_API_KEY at module load
// time would throw during build/import if it's unset (e.g. CI, or before
// the env var is configured), rather than surfacing the intended "not
// configured" GenerateArtError at call time. The SDK also throws its own
// constructor error if handed an empty key, which the explicit check below
// pre-empts with a clearer message.
let client: OpenAI | null = null;
function getClient(apiKey: string): OpenAI {
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/**
 * Calls the OpenAI Images API to generate a stylized pet portrait, via the
 * official `openai` SDK (client.images.edit) rather than a raw fetch().
 *
 * This is real, functional code — not a placeholder. It will actually
 * call OpenAI once OPENAI_API_KEY is set in your environment. It hasn't
 * been exercised against a live key in this build pass (no network access
 * in the sandbox that built it), so treat the first real run as a test:
 * check the response shape against OpenAI's current Images API docs before
 * trusting it in production, since that API does change over time.
 */
export async function generatePetPortrait(
  params: GenerateArtParams
): Promise<GenerateArtResult | GenerateArtError> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "OPENAI_API_KEY is not configured." };
  }

  const fullPrompt = [
    params.basePrompt,
    params.productPrompt,
    `Art style: ${params.artStyleLabel}.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = getClient(apiKey);
    const image = await toFile(params.imageBuffer, params.imageFilename, {
      type: params.imageMimeType,
    });

    const response = await openai.images.edit({
      image,
      prompt: fullPrompt,
      model: "gpt-image-1",
      size: "1024x1024",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        error: "OpenAI response did not include image data.",
      };
    }

    return { success: true, imageBase64: b64 };
  } catch (err) {
    // The SDK throws APIError (with .status/.message already formatted
    // from OpenAI's error body) for non-2xx responses, and plain Errors
    // for network/other failures — both have a usable .message.
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling OpenAI.",
    };
  }
}
