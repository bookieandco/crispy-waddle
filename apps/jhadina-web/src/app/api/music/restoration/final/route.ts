import { NextRequest, NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import {
  certifyRestorationFinal,
  inspectRestorationFinalCertification,
} from "@/lib/music/restoration-final-service";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

async function identityAndClient(req: NextRequest) {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() ?? "";
  if (!claimedUserId) throw new Error("MUSIC_RESTORATION_FINAL_NOT_SIGNED_IN");
  const identity = await (await createRequestIdentityVerifier()).verify({ userId: claimedUserId });
  const client = createServiceRoleClient();
  if (!client) throw new Error("MUSIC_RESTORATION_STORAGE_NOT_CONFIGURED");
  return { identity, client };
}

function statusFor(message: string): number {
  if (/identity|session|signed.in/i.test(message)) return 401;
  if (/NOT_FOUND|not found/i.test(message)) return 404;
  if (/NOT_CONFIGURED|not configured/i.test(message)) return 503;
  if (/TOO_LARGE/i.test(message)) return 413;
  return 422;
}

export async function GET(req: NextRequest) {
  try {
    const { identity, client } = await identityAndClient(req);
    const caseId = req.nextUrl.searchParams.get("caseId")?.trim() ?? "";
    if (!caseId) return privateJson({ success: false, error: "caseId is required" }, 400);
    const result = await inspectRestorationFinalCertification({
      client,
      ownerUserId: identity.userId,
      caseId,
    });
    return privateJson({
      success: true,
      caseId,
      runtime: result.runtime,
      decision: result.decision,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final certification inspection failed";
    return privateJson({ success: false, error: message }, statusFor(message));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { identity, client } = await identityAndClient(req);
    const body = await req.json() as { caseId?: string; certify?: boolean };
    const caseId = body.caseId?.trim() ?? "";
    if (!caseId || body.certify !== true) {
      return privateJson({
        success: false,
        error: "caseId and certify=true are required",
      }, 400);
    }

    const result = await certifyRestorationFinal({
      client,
      ownerUserId: identity.userId,
      caseId,
    });
    return privateJson({
      success: result.certified,
      caseId,
      runtime: result.runtime,
      decision: result.decision,
      certification: result.persisted,
    }, result.certified ? 200 : 409);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Final certification failed";
    return privateJson({ success: false, error: message }, statusFor(message));
  }
}
