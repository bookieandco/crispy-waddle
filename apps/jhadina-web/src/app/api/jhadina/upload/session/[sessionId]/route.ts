import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createProductionDirectUploadRuntime } from "@/lib/intelligence/production-direct-upload-runtime";
import { SupabaseDirectUploadSessionRepository } from "@/lib/intelligence/supabase-direct-upload-session-repository";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actorIdFor(req: NextRequest): Promise<string> {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() || undefined;
  const verifier = await createRequestIdentityVerifier();
  return (await verifier.verify(claimedUserId ? { userId: claimedUserId } : {})).userId;
}

function publicSession(session: Awaited<ReturnType<SupabaseDirectUploadSessionRepository["get"]>>) {
  if (!session) return undefined;
  const effectiveStatus =
    session.status === "issued" && Date.parse(session.expiresAt) <= Date.now()
      ? "expired"
      : session.status;
  return {
    id: session.id,
    filename: session.filename,
    mediaType: session.declaredMediaType,
    modality: session.modality,
    byteLength: session.expectedByteLength,
    privacyClass: session.privacyClass,
    status: effectiveStatus,
    expiresAt: session.expiresAt,
    finalizeAttempt: session.finalizeAttempt,
    finalizeMaxAttempts: session.finalizeMaxAttempts,
    finalizeAvailableAt: session.finalizeAvailableAt,
    assetId: session.assetId,
    perceptionJobId: session.perceptionJobId,
    lastError: session.lastError,
    cleanupStatus: session.cleanupStatus,
    cleanupAttempt: session.cleanupAttempt,
    cleanupError: session.cleanupError,
    cleanedAt: session.cleanedAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  let actorId: string;
  try {
    actorId = await actorIdFor(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      { success: false, error: "DIRECT_UPLOAD_RUNTIME_SUPABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const session = await new SupabaseDirectUploadSessionRepository(client)
      .get(actorId, params.sessionId);
    if (!session) {
      return NextResponse.json({ success: false, error: "Upload session not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: publicSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read upload session";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  let actorId: string;
  try {
    actorId = await actorIdFor(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  try {
    const session = await createProductionDirectUploadRuntime().requestFinalize({
      actorId,
      sessionId: params.sessionId,
    });

    const finalized = session.status === "finalized";
    return NextResponse.json({
      success: true,
      data: {
        session: publicSession(session),
        statusPath: `/api/jhadina/upload/session/${encodeURIComponent(session.id)}`,
        perceptionStatusPath: session.perceptionJobId
          ? `/api/jhadina/perception/${encodeURIComponent(session.perceptionJobId)}`
          : undefined,
      },
    }, { status: finalized ? 200 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue upload finalization";
    const status =
      message.includes("SESSION_NOT_FOUND") ? 404 :
      message.includes("SESSION_EXPIRED") ? 410 :
      message.includes("SESSION_REJECTED") ? 422 :
      message.includes("RUNTIME_") ? 503 :
      message.includes("DIRECT_UPLOAD_") ? 400 :
      500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
