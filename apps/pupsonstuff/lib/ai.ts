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
  /** additional Pet Identity views. The primary image above is always first. */
  referenceImages?: Array<{
    imageBuffer: Buffer;
    imageFilename: string;
    imageMimeType: string;
  }>;
  /** base template from the master prompt, e.g. from AI_PROMPT_TEMPLATE below */
  basePrompt: string;
  /** hotspot.aiTemplate — the product-specific addition, see data/hotspots.ts */
  productPrompt?: string;
  /** shopper-authored direction; bounded by the route before reaching this adapter */
  userPrompt?: string;
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
  model: string;
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
 * The current Image API accepts multiple reference images, so Pet Identity
 * photos are supplied independently rather than collapsed into one contact
 * sheet. The model remains environment-configurable for certification and
 * controlled upgrades.
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
    params.userPrompt ? `Shopper direction: ${params.userPrompt}` : undefined,
    `Art style: ${params.artStyleLabel}.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const openai = getClient(apiKey);
    const references = [
      {
        imageBuffer: params.imageBuffer,
        imageFilename: params.imageFilename,
        imageMimeType: params.imageMimeType,
      },
      ...(params.referenceImages ?? []),
    ].slice(0, 3);
    const images = await Promise.all(
      references.map((reference) =>
        toFile(reference.imageBuffer, reference.imageFilename, {
          type: reference.imageMimeType,
        })
      )
    );
    const model = process.env.PUPSON_OPENAI_IMAGE_MODEL?.trim() || "gpt-image-2.5-sunburst";

    const response = await openai.images.edit({
      image: images,
      prompt: fullPrompt,
      model,
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        error: "OpenAI response did not include image data.",
      };
    }

    return { success: true, imageBase64: b64, model };
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
