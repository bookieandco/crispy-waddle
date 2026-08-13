// app/api/generate-preview/route.ts
//
// POST /api/generate-preview
// multipart/form-data body (matches the spec exactly):
//   photo          - the uploaded pet photo (File)
//   productId      - which hotspot/product this is for (string)
//   artStyle       - which style label was selected (string)
//   cropPosition   - optional JSON string, e.g. {"x":0,"y":0,"scale":1} —
//                    where the customer positioned/cropped their photo
//                    before generating, if your uploader supports that.
//                    Not enforced yet; passed through for the compositing
//                    step to use once it exists (see TODO below).
//
// Returns { success: true, imageBase64 } or { success: false, error }.
//
// This route existed before under a different path/field names
// (app/api/generate-art) — moved here to match the spec exactly, not
// rebuilt from scratch. It's real, functional code: real validation, a
// real call to lib/ai.ts (OpenAI Images API). It hasn't been exercised
// against a live key in this build pass (no network access in the sandbox
// that built it) — test it for real before shipping.

import { NextRequest, NextResponse } from "next/server";
import { generatePetPortrait, AI_PROMPT_TEMPLATE } from "@/lib/ai";
import { imageToAsciiArt } from "@/lib/ascii";
import { generateWithMuapi } from "@/lib/muapi";
import { hotspots } from "@/data/hotspots";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const photo = formData.get("photo");
  const productId = formData.get("productId");
  const artStyle = formData.get("artStyle");
  const artStyleId = formData.get("artStyleId"); // optional — see below
  const cropPositionRaw = formData.get("cropPosition"); // optional

  if (!(photo instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Missing 'photo' file." },
      { status: 400 }
    );
  }
  if (typeof productId !== "string" || typeof artStyle !== "string") {
    return NextResponse.json(
      { success: false, error: "Missing 'productId' or 'artStyle'." },
      { status: 400 }
    );
  }
  if (!ACCEPTED_MIME_TYPES.includes(photo.type)) {
    return NextResponse.json(
      { success: false, error: `Unsupported image type: ${photo.type}` },
      { status: 400 }
    );
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "Image is too large (max 10MB)." },
      { status: 400 }
    );
  }

  let cropPosition: unknown = null;
  if (typeof cropPositionRaw === "string") {
    try {
      cropPosition = JSON.parse(cropPositionRaw);
    } catch {
      return NextResponse.json(
        { success: false, error: "'cropPosition' must be valid JSON." },
        { status: 400 }
      );
    }
  }

  const hotspot = hotspots.find((h) => h.id === productId);
  if (!hotspot) {
    return NextResponse.json(
      { success: false, error: `Unknown productId: ${productId}` },
      { status: 400 }
    );
  }

  // TODO(next pass): before calling the AI, run the Image Quality
  // Assistant checks from the master prompt (resolution, blur, lighting,
  // pet/face visibility) and surface a warning to the client rather than
  // silently proceeding.

  const imageBuffer = Buffer.from(await photo.arrayBuffer());

  let result: { success: true; imageBase64: string } | { success: false; error: string };

  if (artStyleId === "ascii-art") {
    // Deterministic, not generative — see lib/ascii.ts. No OpenAI call,
    // no API key needed, genuinely runs every time (the only generation
    // path here that does, in an environment with no key configured).
    try {
      const png = await imageToAsciiArt(imageBuffer);
      result = { success: true, imageBase64: png.toString("base64") };
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : "Failed to render ASCII art.",
      };
    }
  } else if (artStyleId === "studio-ghibli") {
    // Second AI provider (Muapi.ai, not OpenAI) — see lib/muapi.ts.
    // ai-ghibli-style is a fixed-effect model with no prompt input at
    // all, so no basePrompt/productPrompt gets sent here.
    result = await generateWithMuapi({
      imageBuffer,
      imageFilename: photo.name,
      imageMimeType: photo.type,
      model: "ai-ghibli-style",
    });
  } else if (artStyleId === "flux-dreamscape") {
    // Same Muapi provider, different (prompt-driven) underlying model —
    // reuses the same base prompt template + product/style text the
    // OpenAI path uses below, since flux-kontext-pro-i2i takes a prompt
    // just like gpt-image-1 does.
    result = await generateWithMuapi({
      imageBuffer,
      imageFilename: photo.name,
      imageMimeType: photo.type,
      model: "flux-kontext-pro-i2i",
      prompt: [AI_PROMPT_TEMPLATE, hotspot.aiTemplate, `Art style: ${artStyle}.`]
        .filter(Boolean)
        .join("\n"),
    });
  } else {
    result = await generatePetPortrait({
      imageBuffer,
      imageFilename: photo.name,
      imageMimeType: photo.type,
      basePrompt: AI_PROMPT_TEMPLATE,
      productPrompt: hotspot.aiTemplate,
      artStyleLabel: artStyle,
    });
  }

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  // TODO(next pass): use `cropPosition` (if provided) plus Konva.js to
  // actually composite the generated artwork onto the product's mockup at
  // hotspot.fulfillment.printArea, instead of returning the raw square
  // generation as-is. TODO(next pass): persist original + generated image
  // to Supabase Storage and return a stored URL instead of raw base64.
  void cropPosition;

  return NextResponse.json(result);
}
