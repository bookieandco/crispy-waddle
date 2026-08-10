import { NextRequest, NextResponse } from "next/server";
import { evaluateImageQuality } from "@/lib/pod/quality-gate";
import { getPodProductProfile } from "@/lib/pod/catalog";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = getPodProductProfile(String(body.productId ?? ""));
    if (!product) return NextResponse.json({ success: false, error: "Unknown POD product." }, { status: 400 });

    const width = Number(body.width);
    const height = Number(body.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return NextResponse.json({ success: false, error: "Valid image width and height are required." }, { status: 400 });
    }

    const report = evaluateImageQuality({ width, height, mimeType: body.mimeType, hasPetSubject: body.hasPetSubject, subjectCoverage: body.subjectCoverage }, product);
    return NextResponse.json({ success: true, report });
  } catch {
    return NextResponse.json({ success: false, error: "Invalid quality-check request." }, { status: 400 });
  }
}
