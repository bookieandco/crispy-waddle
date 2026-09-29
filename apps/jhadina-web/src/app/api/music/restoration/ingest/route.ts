import { NextRequest, NextResponse } from "next/server";
import {
  HttpRestorationRuntimeClient,
  ingestRestorationSource,
} from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SupabaseMusicRestorationArtifactStore } from "@/lib/music/restoration-supabase-store";

export const runtime = "nodejs";

function createRuntimeClient(): HttpRestorationRuntimeClient {
  const url = process.env.MUSIC_RESTORATION_WORKER_URL?.trim() ?? "";
  const token = process.env.MUSIC_RESTORATION_WORKER_TOKEN?.trim() ?? "";
  if (!url || !token) throw new Error("MUSIC_RESTORATION_WORKER_NOT_CONFIGURED");
  return new HttpRestorationRuntimeClient(url, token);
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const store = new SupabaseMusicRestorationArtifactStore(client, identity.userId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const caseId = `music-restoration:${globalThis.crypto.randomUUID()}`;
    const result = await ingestRestorationSource({
      ownerUserId: identity.userId,
      caseId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      runtime: createRuntimeClient(),
      store,
    });

    return NextResponse.json({
      success: true,
      restorationCase: {
        id: result.restorationCase.id,
        title: result.restorationCase.title,
        status: result.restorationCase.status,
        sourceVersionId: result.restorationCase.sourceVersionId,
        currentVersionId: result.restorationCase.currentVersionId,
      },
      sourceArtifact: {
        id: result.artifact.id,
        sha256: result.artifact.contentHash,
        sampleRate: result.artifact.sampleRate,
        channels: result.artifact.channels,
        sampleCount: result.artifact.sampleCount,
        sizeBytes: result.artifact.sizeBytes,
      },
      fingerprint: result.fingerprint,
      runtimeReceiptId: result.probe.runtimeReceiptId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music restoration ingest failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /exceeds|too large/i.test(message)
        ? 413
        : /MIME|audio/i.test(message)
          ? 415
          : /NOT_CONFIGURED|not configured/i.test(message)
            ? 503
            : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
