import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createProductionPerceptionJobWorker } from "@/lib/intelligence/production-perception-job-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const configuredBatch = Number(process.env.JHADINA_PERCEPTION_BATCH_SIZE ?? "3");
  const batchSize =
    Number.isInteger(configuredBatch) && configuredBatch > 0
      ? Math.min(configuredBatch, 10)
      : 3;

  const leaseMsRaw = Number(process.env.JHADINA_PERCEPTION_LEASE_MS ?? "60000");
  const leaseMs =
    Number.isInteger(leaseMsRaw) && leaseMsRaw >= 5000
      ? Math.min(leaseMsRaw, 15 * 60_000)
      : 60_000;

  try {
    const worker = createProductionPerceptionJobWorker({
      workerId: `perception:${process.env.VERCEL_REGION ?? "local"}:${randomUUID()}`,
      leaseMs,
    });

    const outcomes = [];
    for (let index = 0; index < batchSize; index += 1) {
      const outcome = await worker.runNext();
      outcomes.push({
        state: outcome.state,
        jobId: "job" in outcome ? outcome.job.id : undefined,
        status: "job" in outcome ? outcome.job.status : undefined,
        attempt: "job" in outcome ? outcome.job.attempt : undefined,
      });
      if (outcome.state === "idle") break;
    }

    return NextResponse.json({
      ok: true,
      processed: outcomes.filter((item) => item.state !== "idle").length,
      outcomes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Perception worker failed";
    const status = message.includes("PERCEPTION_RUNTIME_") ? 503 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
