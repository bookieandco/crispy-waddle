import { NextRequest, NextResponse } from "next/server";
import { buildRuntimeWorkProjection } from "@jhadina/core-spine";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SupabaseWorkSessionRepository } from "@/lib/work-session/supabase-work-session-repository";
import { SupabaseWorkSessionTaskRepository } from "@/lib/work-session/supabase-work-session-task-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Owner-bound READ ONLY canonical WorkSession projection.
 *
 * It never claims or retries a task, interprets approval as authority, writes
 * storage, or treats a front-end user-id header as proof of authentication.
 */
export async function GET(
  request: NextRequest,
  route: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await route.params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return failure("WORK_SESSION_ID_INVALID", 400);
    const claimedUserId = request.headers.get("x-jhadina-user-id");
    if (!claimedUserId) return failure("WORK_SESSION_IDENTITY_REQUIRED", 401);
    const verifier = await createRequestIdentityVerifier();
    let identity: Awaited<ReturnType<typeof verifier.verify>>;
    try {
      identity = await verifier.verify({ userId: claimedUserId });
    } catch {
      return failure("WORK_SESSION_IDENTITY_UNVERIFIED", 401);
    }
    if (!identity.userId || identity.userId !== claimedUserId) {
      return failure("WORK_SESSION_IDENTITY_MISMATCH", 401);
    }
    const database = createServiceRoleClient();
    if (!database) return failure("WORK_SESSION_STORAGE_UNAVAILABLE", 503);

    const workSessions = new SupabaseWorkSessionRepository(database, identity.userId);
    const session = await workSessions.get(id);
    if (!session) return failure("WORK_SESSION_NOT_FOUND", 404);
    if (session.ownerUserId !== identity.userId || session.id !== id) {
      return failure("WORK_SESSION_NOT_FOUND", 404);
    }

    const tasksRepository = new SupabaseWorkSessionTaskRepository(database, identity.userId);
    const tasks = await tasksRepository.list(id);
    // Defensive cross-tenant check even when SQL RLS / owner filter is in use.
    if (tasks.some(task => task.ownerUserId !== identity.userId || task.workSessionId !== id)) {
      return failure("WORK_SESSION_PROJECTION_SCOPE_MISMATCH", 503);
    }

    return NextResponse.json({
      success: true,
      workSessionId: id,
      goal: session.goal,
      sessionStatus: session.status,
      projection: buildRuntimeWorkProjection(id, tasks),
      coverage: "canonical-work-session-only",
    }, { headers: PRIVATE });
  } catch {
    // Never expose SQL, JWT, provider, or private task details in a failure.
    return failure("WORK_SESSION_PROJECTION_UNAVAILABLE", 503);
  }
}

function failure(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status, headers: PRIVATE });
}
