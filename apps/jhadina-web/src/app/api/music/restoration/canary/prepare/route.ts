import { NextRequest, NextResponse } from "next/server";
import { authorizedNoGoodCanaryRequest } from "@/lib/music/restoration-no-good-canary-auth";
import {
  NO_GOOD_BENCHMARK,
  prepareNoGoodCanaryUpload,
} from "@/lib/music/restoration-no-good-canary";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      repository?: string;
      sourceCommit?: string;
      sourcePath?: string;
    };
    if (
      !body.runId?.trim() ||
      body.repository !== NO_GOOD_BENCHMARK.repository ||
      body.sourceCommit !== NO_GOOD_BENCHMARK.sourceCommit ||
      body.sourcePath !== NO_GOOD_BENCHMARK.sourcePath
    ) {
      return NextResponse.json(
        { success: false, error: "MUSIC_RESTORATION_CANARY_PROVENANCE_INVALID" },
        { status: 400, headers: PRIVATE_HEADERS },
      );
    }

    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const prepared = await prepareNoGoodCanaryUpload({
      client,
      runId: body.runId,
    });
    return NextResponse.json(
      { success: true, ...prepared },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "No Good canary upload preparation failed";
    const status = /NOT_CONFIGURED|not configured/i.test(message) ? 503 : 422;
    return NextResponse.json(
      { success: false, error: message },
      { status, headers: PRIVATE_HEADERS },
    );
  }
}
