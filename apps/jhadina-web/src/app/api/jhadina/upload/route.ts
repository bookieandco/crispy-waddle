import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import {
  createProductionUniversalUploadRuntime,
  type UniversalUploadPrivacyClass,
} from "@/lib/intelligence/production-universal-upload-runtime";
import { MAX_UNIVERSAL_UPLOAD_BYTES } from "@/lib/intelligence/universal-upload-validation";

export const dynamic = "force-dynamic";

const PRIVACY_CLASSES = new Set<UniversalUploadPrivacyClass>([
  "internal",
  "sensitive",
  "restricted",
]);

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() || undefined;
  let actorId: string;
  try {
    const verifier = await createRequestIdentityVerifier();
    actorId = (await verifier.verify(claimedUserId ? { userId: claimedUserId } : {})).userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  const contentLength = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_UNIVERSAL_UPLOAD_BYTES + 2 * 1024 * 1024) {
    return NextResponse.json(
      { success: false, error: "Upload exceeds the 512 MiB universal intake limit." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Expected multipart/form-data." },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Missing 'file' upload." },
      { status: 400 },
    );
  }
  if (file.size <= 0) {
    return NextResponse.json({ success: false, error: "Upload is empty." }, { status: 400 });
  }
  if (file.size > MAX_UNIVERSAL_UPLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "Upload exceeds the 512 MiB universal intake limit." },
      { status: 413 },
    );
  }

  const rawPrivacy = formData.get("privacyClass");
  const privacyClass: UniversalUploadPrivacyClass =
    typeof rawPrivacy === "string" && PRIVACY_CLASSES.has(rawPrivacy as UniversalUploadPrivacyClass)
      ? rawPrivacy as UniversalUploadPrivacyClass
      : "sensitive";

  const rawIntent = formData.get("intent");
  const intent = typeof rawIntent === "string" ? rawIntent.trim().slice(0, 4000) : undefined;

  try {
    const runtime = createProductionUniversalUploadRuntime();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await runtime.ingest({
      actorId,
      filename: file.name || "upload.bin",
      declaredMediaType: file.type,
      bytes,
      privacyClass,
      intent,
    });

    return NextResponse.json({
      success: true,
      data: {
        asset: {
          id: result.asset.id,
          filename: result.asset.filename,
          modality: result.asset.modality,
          mediaType: result.asset.mediaType,
          privacyClass: result.asset.privacyClass,
          byteLength: result.asset.byteLength,
          contentSha256: result.asset.contentSha256,
          createdAt: result.asset.createdAt,
        },
        scan: result.scan,
        evidence: result.packet.evidence,
        uncertainty: result.packet.uncertainty,
        routing: result.packet.routing,
        dispatch: result.dispatch,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status =
      message.includes("UPLOAD_RUNTIME_") ? 503 :
      message.includes("MEDIA_SCANNER_HTTP_") ? 502 :
      message.includes("UPLOAD_TOO_LARGE") ? 413 :
      message.includes("UPLOAD_TYPE_MISMATCH_OR_UNSUPPORTED") ? 415 :
      message.includes("SUBSYSTEM_SELECTION_REQUIRED") ? 409 :
      message.includes("MEDIA_SECURITY_QUARANTINE") ||
      message.includes("MEDIA_SECURITY_NEEDS_REVIEW") ||
      message.includes("MEDIA_SECURITY_REJECTED") ? 422 :
      message.includes("UPLOAD_") ||
      message.includes("MEDIA_SCANNER_") ? 400 :
      500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}
