import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createProductionDirectUploadFinalizationWorker } from "@/lib/intelligence/production-direct-upload-finalization-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const batchRaw = Number(process.env.JHADINA_UPLOAD_FINALIZE_BATCH_SIZE ?? "2");
  const batchSize =
    Number.isInteger(batchRaw) && batchRaw > 0
      ? Math.min(batchRaw, 10)
      : 2;

  const cleanupBatchRaw = Number(process.env.JHADINA_UPLOAD_CLEANUP_BATCH_SIZE ?? "5");
  const cleanupBatchSize =
    Number.isInteger(cleanupBatchRaw) && cleanupBatchRaw > 0
      ? Math.min(cleanupBatchRaw, 20)
      : 5;

  const orphanBatchRaw = Number(process.env.JHADINA_UPLOAD_ORPHAN_CLEANUP_BATCH_SIZE ?? "5");
  const orphanBatchSize =
    Number.isInteger(orphanBatchRaw) && orphanBatchRaw > 0
      ? Math.min(orphanBatchRaw, 20)
      : 5;

  const leaseMsRaw = Number(process.env.JHADINA_UPLOAD_FINALIZE_LEASE_MS ?? "300000");
  const leaseMs =
    Number.isInteger(leaseMsRaw) && leaseMsRaw >= 5000
      ? Math.min(leaseMsRaw, 30 * 60_000)
      : 5 * 60_000;

  try {
    const worker = createProductionDirectUploadFinalizationWorker({
      workerId: `upload-finalize:${process.env.VERCEL_REGION ?? "local"}:${randomUUID()}`,
      leaseMs,
    });

    const finalization = [];
    for (let index = 0; index < batchSize; index += 1) {
      const outcome = await worker.runFinalizeNext();
      finalization.push({
        state: outcome.state,
        sessionId: "session" in outcome ? outcome.session.id : undefined,
        status: "session" in outcome ? outcome.session.status : undefined,
        attempt: "session" in outcome ? outcome.session.finalizeAttempt : undefined,
      });
      if (outcome.state === "idle") break;
    }

    const cleanup = [];
    for (let index = 0; index < cleanupBatchSize; index += 1) {
      const outcome = await worker.runCleanupNext();
      cleanup.push({
        state: outcome.state,
        sessionId: "session" in outcome ? outcome.session.id : undefined,
        cleanupStatus: "session" in outcome ? outcome.session.cleanupStatus : undefined,
        attempt: "session" in outcome ? outcome.session.cleanupAttempt : undefined,
      });
      if (outcome.state === "idle") break;
    }

    const orphanCleanup = [];
    for (let index = 0; index < orphanBatchSize; index += 1) {
      const outcome = await worker.runOrphanCleanupNext();
      orphanCleanup.push(outcome);
      if (outcome.state === "idle") break;
    }

    return NextResponse.json({
      ok: true,
      finalizationProcessed: finalization.filter((item) => item.state !== "idle").length,
      cleanupProcessed: cleanup.filter((item) => item.state !== "idle").length,
      orphanCleanupProcessed: orphanCleanup.filter((item) => item.state !== "idle").length,
      finalization,
      cleanup,
      orphanCleanup,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload finalization worker failed";
    const status = message.includes("DIRECT_UPLOAD_WORKER_") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
