import { NextRequest, NextResponse } from "next/server";
import { authorizedNoGoodCanaryRequest } from "@/lib/music/restoration-no-good-canary-auth";
import { runNoGoodProductionCanary } from "@/lib/music/restoration-no-good-canary";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby rejects Serverless Functions whose maxDuration exceeds 300 seconds.
export const maxDuration = 300;

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest) {
  if (!(await authorizedNoGoodCanaryRequest(req))) {
    return NextResponse.json(
      { success: false, error: "MUSIC_RESTORATION_CANARY_UNAUTHORIZED" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const body = await req.json() as {
      runId?: string;
      stagingPath?: string;
      expectedSha256?: string;
      expectedSizeBytes?: number;
      repository?: string;
      sourceCommit?: string;
      sourcePath?: string;
    };
    if (
      !body.runId?.trim() ||
      !body.stagingPath?.trim() ||
      !body.expectedSha256?.trim() ||
      typeof body.expectedSizeBytes !== "number" ||
      !Number.isSafeInteger(body.expectedSizeBytes)
    ) {
      return NextResponse.json(
        { success: false, error: "MUSIC_RESTORATION_CANARY_EXECUTION_INPUT_INVALID" },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const result = await runNoGoodProductionCanary({
      client,
      runId: body.runId,
      stagingPath: body.stagingPath,
      expectedSha256: body.expectedSha256,
      expectedSizeBytes: body.expectedSizeBytes,
      repository: body.repository ?? "",
      sourceCommit: body.sourceCommit ?? "",
      sourcePath: body.sourcePath ?? "",
    });
    return NextResponse.json(
      {
        success: result.status === "completed",
        ...result,
      },
      {
        status: result.status === "blocked" ? 409 : 200,
        headers: PRIVATE_HEADERS,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No Good production canary failed";
    const status =
      /UNAUTHORIZED/i.test(message) ? 401 :
      /NOT_CONFIGURED|productionReady|runtime|worker/i.test(message) ? 503 :
      /MISMATCH|INVALID|REQUIRED/i.test(message) ? 400 :
      422;
    return NextResponse.json(
      { success: false, status: "blocked", error: message },
      { status, headers: PRIVATE_HEADERS },
    );
  }
}
