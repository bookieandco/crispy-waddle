import { NextRequest, NextResponse } from "next/server";
import { ingestRestorationSource, ingestRestorationPrototypeWav, MAX_MUSIC_PROTOTYPE_WAV_BYTES } from "@jhadina/music-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createMusicRestorationRuntimeClient } from "@/lib/music/restoration-runtime-server";
import { SupabaseMusicRestorationArtifactStore } from "@/lib/music/restoration-supabase-store";
import { createRuntimeServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

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

    const isPrototype=req.nextUrl.searchParams.get("mode")==="prototype-wav";
    if(isPrototype && (file.size===0 || file.size>MAX_MUSIC_PROTOTYPE_WAV_BYTES)) {
      return NextResponse.json({success:false,error:"MUSIC_PROTOTYPE_WAV_SIZE_INVALID: limit 3 MiB"},{status:413});
    }
    const client = await createRuntimeServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const store = new SupabaseMusicRestorationArtifactStore(client, identity.userId);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const caseId = `music-restoration:${globalThis.crypto.randomUUID()}`;
    const common = {
      ownerUserId: identity.userId,
      caseId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
      store,
    };
    // No worker fallback is implicit. Only explicitly requested WAV draft mode
    // bypasses remote probing, and it cannot claim a restoration receipt.
    const result = isPrototype
      ? await ingestRestorationPrototypeWav(common)
      : await ingestRestorationSource({
          ...common,runtime:await createMusicRestorationRuntimeClient(),
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
      runtimeReceiptId: "probe" in result ? result.probe.runtimeReceiptId : null,
      mode:isPrototype?"prototype-wav":"runtime-probed",
      workerUsed:!isPrototype,
      restorationCertified:false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music restoration ingest failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /exceeds|too large|WAV_SIZE_INVALID/i.test(message)
        ? 413
        : /MIME|audio|WAV_ONLY|WAV_FORMAT_UNSUPPORTED/i.test(message)
          ? 415
          : /NOT_CONFIGURED|not configured/i.test(message)
            ? 503
            : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
