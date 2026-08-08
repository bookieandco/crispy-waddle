// lib/animation.ts
//
// Server-only. Never import this from a client component — it reads
// process.env.HUGGINGFACE_API_KEY, which must never reach the browser.
//
// Second step on top of lib/ai.ts's static portrait generation: takes an
// already-generated pet portrait and turns it into a short looping video
// via Hugging Face's Inference Providers (image-to-video task), using the
// official @huggingface/inference JS SDK — the same "use the JS/TS
// equivalent, not the Python one" call made for lib/ai.ts and the OpenAI
// SDK.

import { InferenceClient } from "@huggingface/inference";

export interface AnimatePortraitParams {
  /** the already-generated static portrait, as a Buffer */
  imageBuffer: Buffer;
  imageMimeType: string;
}

export interface AnimateArtResult {
  success: true;
  videoBase64: string;
  mimeType: string;
}

export interface AnimateArtError {
  success: false;
  error: string;
}

// @huggingface/inference's own imageToVideo() doc comment names this as
// its recommended default model for the task. Not benchmarked against
// alternatives here — swapping it is a one-line change if it turns out
// wrong for "subtle looping portrait motion" specifically once someone
// actually looks at real output.
const MODEL = "Wan-AI/Wan2.1-I2V-14B-720P";

let client: InferenceClient | null = null;
function getClient(accessToken: string): InferenceClient {
  if (!client) client = new InferenceClient(accessToken);
  return client;
}

/**
 * Turns a static generated pet portrait into a short looping video.
 *
 * Real, functional code — not a placeholder. It will actually call
 * Hugging Face once HUGGINGFACE_API_KEY is set. Not exercised against a
 * live key in this build pass (no network access in the sandbox that
 * built it) — same honest caveat as lib/ai.ts's OpenAI call: treat the
 * first real run as a test. Image-to-video models are sensitive to
 * prompt/parameter tuning in ways image generation isn't as much —
 * expect to adjust `num_frames`/the prompt below once you see real
 * output, not just once and assume it's right.
 */
export async function animatePetPortrait(
  params: AnimatePortraitParams
): Promise<AnimateArtResult | AnimateArtError> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return { success: false, error: "HUGGINGFACE_API_KEY is not configured." };
  }

  try {
    const hf = getClient(apiKey);
    const videoBlob = await hf.imageToVideo({
      model: MODEL,
      inputs: new Blob([new Uint8Array(params.imageBuffer)], {
        type: params.imageMimeType,
      }),
      parameters: {
        prompt:
          "subtle gentle idle motion, soft breathing, slight fur or fabric movement, seamless looping animation, camera perfectly static",
        negative_prompt:
          "camera movement, zoom, pan, dramatic motion, scene change, new objects, morphing, text, watermark",
        num_frames: 25,
      },
    });

    const arrayBuffer = await videoBlob.arrayBuffer();
    const videoBase64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      success: true,
      videoBase64,
      mimeType: videoBlob.type || "video/mp4",
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Unknown error calling Hugging Face.",
    };
  }
}
