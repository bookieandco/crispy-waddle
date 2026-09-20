import { NextRequest, NextResponse } from "next/server";
import type { SubsystemId } from "@jhadina/intelligence-core";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { PRODUCTION_SUBSYSTEM_IDS } from "@/lib/intelligence/production-subsystem-registry";
import { SupabasePerceptionJobRepository } from "@/lib/intelligence/supabase-perception-job-repository";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actorIdFor(req: NextRequest): Promise<string> {
  const claimedUserId = req.headers.get("x-jhadina-user-id")?.trim() || undefined;
  const verifier = await createRequestIdentityVerifier();
  return (await verifier.verify(claimedUserId ? { userId: claimedUserId } : {})).userId;
}

function publicJob(job: Awaited<ReturnType<SupabasePerceptionJobRepository["get"]>>) {
  if (!job) return undefined;
  return {
    id: job.id,
    assetId: job.assetId,
    status: job.status,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    lastError: job.lastError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    proposedRoutes: job.packet?.routing.routes ?? [],
    evidence: job.status === "completed" || job.status === "needs_selection"
      ? job.packet?.evidence ?? []
      : [],
    uncertainty: job.status === "completed" || job.status === "needs_selection"
      ? job.packet?.uncertainty ?? []
      : [],
    dispatch: job.status === "completed" ? job.dispatch : undefined,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
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
      { success: false, error: "PERCEPTION_RUNTIME_SUPABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  const repo = new SupabasePerceptionJobRepository(client);
  const job = await repo.get(actorId, params.jobId);
  if (!job) {
    return NextResponse.json({ success: false, error: "Perception job not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: publicJob(job) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  let actorId: string;
  try {
    actorId = await actorIdFor(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ success: false, error: message }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Expected JSON body" }, { status: 400 });
  }

  const raw = (body as { subsystems?: unknown })?.subsystems;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { success: false, error: "subsystems must be a non-empty array" },
      { status: 400 },
    );
  }

  const allowed = new Set<string>(PRODUCTION_SUBSYSTEM_IDS);
  const subsystems = [...new Set(raw)].filter(
    (value): value is SubsystemId => typeof value === "string" && allowed.has(value),
  );
  if (subsystems.length !== raw.length) {
    return NextResponse.json(
      { success: false, error: "One or more subsystem selections are invalid or duplicated" },
      { status: 400 },
    );
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      { success: false, error: "PERCEPTION_RUNTIME_SUPABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  try {
    const repo = new SupabasePerceptionJobRepository(client);
    const job = await repo.requeueWithSelection({
      actorId,
      jobId: params.jobId,
      subsystems,
    });
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job is not awaiting subsystem selection" },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, data: publicJob(job) }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Selection failed";
    const status = message.includes("SELECTION_NOT_PROPOSED") ? 409 :
      message.includes("SELECTION_") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
