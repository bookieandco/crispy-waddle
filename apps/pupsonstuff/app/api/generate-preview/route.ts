// app/api/generate-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { generatePetPortrait, AI_PROMPT_TEMPLATE } from "@/lib/ai";
import { imageToAsciiArt } from "@/lib/ascii";
import { generateWithMuapi } from "@/lib/muapi";
import { hotspots } from "@/data/hotspots";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data." }, { status: 400 });
  }

  const photo = formData.get("photo");
  const productId = formData.get("productId");
  const artStyle = formData.get("artStyle");
  const artStyleId = formData.get("artStyleId");
  const customization = formData.get("customization");

  if (!(photo instanceof File)) return NextResponse.json({ success: false, error: "Missing 'photo' file." }, { status: 400 });
  if (typeof productId !== "string" || typeof artStyle !== "string") return NextResponse.json({ success: false, error: "Missing 'productId' or 'artStyle'." }, { status: 400 });
  if (!ACCEPTED_MIME_TYPES.includes(photo.type)) return NextResponse.json({ success: false, error: `Unsupported image type: ${photo.type}` }, { status: 400 });
  if (photo.size > MAX_UPLOAD_BYTES) return NextResponse.json({ success: false, error: "Image is too large (max 10MB)." }, { status: 400 });

  const hotspot = hotspots.find((h) => h.id === productId);
  if (!hotspot) return NextResponse.json({ success: false, error: `Unknown productId: ${productId}` }, { status: 400 });

  let customizationText = "";
  if (typeof customization === "string") {
    try {
      const parsed = JSON.parse(customization) as Record<string, unknown>;
      customizationText = Object.entries(parsed).map(([key, value]) => `${key}: ${String(value)}`).join(", ");
    } catch {
      return NextResponse.json({ success: false, error: "'customization' must be valid JSON." }, { status: 400 });
    }
  }

  const imageBuffer = Buffer.from(await photo.arrayBuffer());
  const productInstruction = [hotspot.aiTemplate, customizationText ? `Customer customization: ${customizationText}.` : ""]
    .filter(Boolean).join("\n");

  let result: { success: true; imageBase64: string } | { success: false; error: string };
  if (artStyleId === "ascii-art") {
    try { result = { success: true, imageBase64: (await imageToAsciiArt(imageBuffer)).toString("base64") }; }
    catch (err) { result = { success: false, error: err instanceof Error ? err.message : "Failed to render ASCII art." }; }
  } else if (artStyleId === "studio-ghibli") {
    result = await generateWithMuapi({ imageBuffer, imageFilename: photo.name, imageMimeType: photo.type, model: "ai-ghibli-style" });
  } else if (artStyleId === "flux-dreamscape") {
    result = await generateWithMuapi({ imageBuffer, imageFilename: photo.name, imageMimeType: photo.type, model: "flux-kontext-pro-i2i", prompt: [AI_PROMPT_TEMPLATE, productInstruction, `Art style: ${artStyle}.`].filter(Boolean).join("\n") });
  } else {
    result = await generatePetPortrait({ imageBuffer, imageFilename: photo.name, imageMimeType: photo.type, basePrompt: AI_PROMPT_TEMPLATE, productPrompt: productInstruction, artStyleLabel: artStyle });
  }

  if (!result.success) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
