// lib/ai.ts
// Server-only. Never import this from a client component.

import OpenAI, { toFile } from "openai";

export interface GenerateArtParams {
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: string;
  basePrompt: string;
  productPrompt?: string;
  artStyleLabel: string;
  userPrompt?: string;
  outputCount?: number;
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
  outputCount: number;
}

export interface GenerateArtError {
  success: false;
  error: string;
}

let client: OpenAI | null = null;
function getClient(apiKey: string): OpenAI {
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export async function generatePetPortrait(
  params: GenerateArtParams
): Promise<GenerateArtResult | GenerateArtError> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: "OPENAI_API_KEY is not configured." };
  }

  const outputCount = Math.min(Math.max(params.outputCount ?? 1, 1), 3);
  const fullPrompt = [
    params.basePrompt,
    params.productPrompt,
    `Art style: ${params.artStyleLabel}.`,
    params.userPrompt ? `Customer instructions: ${params.userPrompt}` : undefined,
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
      n: outputCount,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return {
        success: false,
        error: "OpenAI response did not include image data.",
      };
    }

    return { success: true, imageBase64: b64, outputCount };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error calling OpenAI.",
    };
  }
}
