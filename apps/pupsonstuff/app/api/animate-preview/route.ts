// app/api/animate-preview/route.ts
//
// POST /api/animate-preview
// JSON body: { imageBase64: string } — either a raw base64 string or a
// full data: URL (what the client actually has on hand: previewUrl is
// built as `data:image/png;base64,${data.imageBase64}` in ProductModal.tsx)
//
// Turns an already-generated static portrait into a short looping video
// via lib/animation.ts (Hugging Face image-to-video). A separate route
// from /api/generate-preview on purpose — animation is an optional second
// step on top of a static image the customer has already seen and can
// re-run independently, not part of the initial generation call.

import { NextRequest, NextResponse } from "next/server";
import { animatePetPortrait } from "@/lib/animation";

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected a JSON body." },
      { status: 400 }
    );
  }

  if (typeof body.imageBase64 !== "string" || !body.imageBase64) {
    return NextResponse.json(
      { success: false, error: "Missing 'imageBase64'." },
      { status: 400 }
    );
  }

  // No `s` (dotAll) flag needed/available at this tsconfig's target — a
  // base64 data URL is a single line, so plain `.` already matches it all.
  const dataUrlMatch = body.imageBase64.match(/^data:([^;]+);base64,(.*)$/);
  const mimeType = dataUrlMatch?.[1] ?? "image/png";
  const rawBase64 = dataUrlMatch ? dataUrlMatch[2] : body.imageBase64;

  let imageBuffer: Buffer;
  try {
    imageBuffer = Buffer.from(rawBase64, "base64");
    if (imageBuffer.length === 0) throw new Error("empty");
  } catch {
    return NextResponse.json(
      { success: false, error: "'imageBase64' is not valid base64 image data." },
      { status: 400 }
    );
  }

  const result = await animatePetPortrait({
    imageBuffer,
    imageMimeType: mimeType,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result);
}
