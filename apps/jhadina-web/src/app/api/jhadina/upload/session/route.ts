import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import {
  createProductionDirectUploadRuntime,
} from "@/lib/intelligence/production-direct-upload-runtime";
import type { UniversalUploadPrivacyClass } from "@/lib/intelligence/production-universal-upload-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVACY = new Set<UniversalUploadPrivacyClass>([
  "internal",
  "sensitive",
  "restricted",
]);

export async function POST(req: NextRequest) {
  let actorId: string;
  try {
    const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() || undefined;
    const verifier = await createRequestIdentityVerifier();
    actorId = (await verifier.verify(claimedUserId ? { userId: claimedUserId } : {})).userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Expected JSON body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  const declaredMediaType = typeof input.mediaType === "string" ? input.mediaType.trim() : "";
  const byteLength = typeof input.byteLength === "number" ? input.byteLength : NaN;
  const privacyClass =
    typeof input.privacyClass === "string" && PRIVACY.has(input.privacyClass as UniversalUploadPrivacyClass)
      ? input.privacyClass as UniversalUploadPrivacyClass
      : "sensitive";
  const intent = typeof input.intent === "string" ? input.intent.trim().slice(0, 4000) : undefined;

  if (!filename) {
    return NextResponse.json({ success: false, error: "filename is required" }, { status: 400 });
  }
  if (!declaredMediaType) {
    return NextResponse.json({ success: false, error: "mediaType is required" }, { status: 400 });
  }
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    return NextResponse.json({ success: false, error: "byteLength must be a positive integer" }, { status: 400 });
  }

  try {
    const result = await createProductionDirectUploadRuntime().issue({
      actorId,
      filename,
      declaredMediaType,
      byteLength,
      privacyClass,
      intent,
    });

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: result.session.id,
          status: result.session.status,
          filename: result.session.filename,
          mediaType: result.session.declaredMediaType,
          modality: result.session.modality,
          byteLength: result.session.expectedByteLength,
          privacyClass: result.session.privacyClass,
          expiresAt: result.session.expiresAt,
        },
        upload: result.upload,
        finalizePath: `/api/jhadina/upload/session/${encodeURIComponent(result.session.id)}`,
      },
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to issue upload session";
    const status =
      message.includes("RUNTIME_") ? 503 :
      message.includes("PRIVACY_INCOMPATIBLE") ? 422 :
      message.includes("TOO_LARGE") ? 413 :
      message.includes("TYPE_UNSUPPORTED") ? 415 :
      message.includes("UPLOAD_") || message.includes("DIRECT_UPLOAD_") ? 400 :
      500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
