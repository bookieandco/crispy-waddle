import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { analyzeRestorationArtifact } from "@/lib/music/restoration-analysis-service";
import { createRequestMusicRestorationRuntimeClient } from "@/lib/music/restoration-runtime-server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface AnalyzeBody {
  caseId?: string;
  artifactId?: string;
  separate?: boolean;
  modelId?: string;
}

export async function POST(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const body = await req.json() as AnalyzeBody;
    const caseId = body.caseId?.trim() ?? "";
    const artifactId = body.artifactId?.trim() ?? "";
    if (!caseId || !artifactId) {
      return NextResponse.json({ success: false, error: "caseId and artifactId are required" }, { status: 400 });
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const runtimeClient = await createRequestMusicRestorationRuntimeClient(identity.userId);
    const result = await analyzeRestorationArtifact({
      client,
      ownerUserId: identity.userId,
      caseId,
      artifactId,
      separate: body.separate,
      modelId: body.modelId,
      runtime: runtimeClient,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Music restoration analysis failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /NOT_CONFIGURED|not configured/i.test(message)
          ? 503
          : 422;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
