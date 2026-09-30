import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import {
  getRestorationStudioCase,
  listRestorationStudioCases,
} from "@/lib/music/restoration-studio-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_JSON_HEADERS = { "Cache-Control": "private, no-store" };

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_JSON_HEADERS });
}

export async function GET(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) {
    return privateJson({ success: false, error: "Not signed in" }, 401);
  }

  try {
    const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
    const client = createServiceRoleClient();
    if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
    const caseId = req.nextUrl.searchParams.get("caseId")?.trim();

    if (!caseId) {
      const cases = await listRestorationStudioCases({ client, ownerUserId: identity.userId });
      return privateJson({ success: true, cases });
    }

    const snapshot = await getRestorationStudioCase({
      client,
      ownerUserId: identity.userId,
      caseId,
    });
    return privateJson({ success: true, ...snapshot });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Restoration Studio read failed";
    const status = /identity|session|signed in/i.test(message)
      ? 401
      : /NOT_FOUND|not found/i.test(message)
        ? 404
        : /NOT_CONFIGURED|not configured/i.test(message)
          ? 503
          : 422;
    return privateJson({ success: false, error: message }, status);
  }
}
