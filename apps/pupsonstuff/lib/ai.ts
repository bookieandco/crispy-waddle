// lib/ai.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.OPENAI_API_KEY, which must never reach the browser.

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/edits";

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

/**
 * Calls the OpenAI Images API to generate a stylized pet portrait.
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

  const form = new FormData();
  form.append(
    "image",
    new Blob([params.imageBuffer], { type: params.imageMimeType }),
    params.imageFilename
  );
  form.append("prompt", fullPrompt);
  form.append("model", "gpt-image-1");
  form.append("size", "1024x1024");
  form.append("n", "1");

  try {
    const res = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `OpenAI Images API error (${res.status}): ${text}`,
      };
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        error: "OpenAI response did not include image data.",
      };
    }

    return { success: true, imageBase64: b64 };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling OpenAI.",
    };
  }
}
