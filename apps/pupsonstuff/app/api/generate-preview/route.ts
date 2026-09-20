// app/api/generate-preview/route.ts
//
// POST /api/generate-preview
// multipart/form-data:
//   photo          - uploaded pet photo
//   productId      - hotspot/product id
//   artStyle       - selected style label
//   artStyleId     - optional stable style id
//   userPrompt     - optional natural-language customer instructions
//   cropPosition   - optional normalized placement JSON

import { NextRequest, NextResponse } from "next/server";
import { generatePetPortrait, AI_PROMPT_TEMPLATE } from "@/lib/ai";
import { imageToAsciiArt } from "@/lib/ascii";
import { generateWithMuapi } from "@/lib/muapi";
import { hotspots } from "@/data/hotspots";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data." }, { status: 400 });
  }

  const photo = formData.get("photo");
  const productId = formData.get("productId");
  const artStyle = formData.get("artStyle");
  const artStyleId = formData.get("artStyleId");
  const userPrompt = formData.get("userPrompt");
  const cropPositionRaw = formData.get("cropPosition");

  if (!(photo instanceof File)) {
    return NextResponse.json({ success: false, error: "Missing 'photo' file." }, { status: 400 });
  }
  if (typeof productId !== "string" || typeof artStyle !== "string") {
    return NextResponse.json({ success: false, error: "Missing 'productId' or 'artStyle'." }, { status: 400 });
  }
  if (!ACCEPTED_MIME_TYPES.includes(photo.type)) {
    return NextResponse.json({ success: false, error: `Unsupported image type: ${photo.type}` }, { status: 400 });
  }
  if (photo.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, error: "Image is too large (max 10MB)." }, { status: 400 });
  }

  let cropPosition: unknown = null;
  if (typeof cropPositionRaw === "string") {
    try {
      cropPosition = JSON.parse(cropPositionRaw);
    } catch {
      return NextResponse.json({ success: false, error: "'cropPosition' must be valid JSON." }, { status: 400 });
    }
  }

  const hotspot = hotspots.find((h) => h.id === productId);
  if (!hotspot) {
    return NextResponse.json({ success: false, error: `Unknown productId: ${productId}` }, { status: 400 });
  }

  const imageBuffer = Buffer.from(await photo.arrayBuffer());
  const customerPrompt = typeof userPrompt === "string" ? userPrompt.trim().slice(0, 2000) : undefined;

  let result:
    | { success: true; imageBase64: string; outputCount?: number }
    | { success: false; error: string };

  if (artStyleId === "ascii-art") {
    try {
      const png = await imageToAsciiArt(imageBuffer);
      result = { success: true, imageBase64: png.toString("base64"), outputCount: 1 };
    } catch (err) {
      result = { success: false, error: err instanceof Error ? err.message : "Failed to render ASCII art." };
    }
  } else if (artStyleId === "studio-ghibli") {
    result = await generateWithMuapi({
      imageBuffer,
      imageFilename: photo.name,
      imageMimeType: photo.type,
      model: "ai-ghibli-style",
    });
  } else if (artStyleId === "flux-dreamscape") {
    result = await generateWithMuapi({
      imageBuffer,
      imageFilename: photo.name,
      imageMimeType: photo.type,
      model: "flux-kontext-pro-i2i",
      prompt: [AI_PROMPT_TEMPLATE, hotspot.aiTemplate, `Art style: ${artStyle}.`, customerPrompt ? `Customer instructions: ${customerPrompt}` : undefined]
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
      userPrompt: customerPrompt,
      outputCount: 3,
    });
  }

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  // Placement remains client-editable until the composition/Print Master pass.
  // Keep it in the request contract now so the editor and final compositor
  // share one normalized representation.
  void cropPosition;

  return NextResponse.json(result);
}
