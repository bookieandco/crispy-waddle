import { NextResponse } from "next/server";
import { CandidatePipelineMutationService } from "../../../../../../packages/staffing-core/src/candidate-pipeline-mutation.js";
import { PostgresCandidatePipelineStore } from "../../../../../../packages/staffing-core/src/postgres-candidate-pipeline.js";
import { createSqlExecutor } from "../../../../../lib/postgres.js";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const organizationId = request.headers.get("x-organization-id");
    const applicationId = (await context.params).applicationId;
    if (!organizationId || !applicationId) return NextResponse.json({ error: "Missing candidate context" }, { status: 400 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const body = await request.json();
    const stage = String(body.stage);
    const rows = await createSqlExecutor(client).query<any>(
      `select id, organization_id as "organizationId", job_id as "jobId", worker_id as "workerId", status,
              cover_note as "coverNote", created_at as "createdAt", updated_at as "updatedAt"
       from staffing_applications where id = $1 and organization_id = $2 limit 1`,
      [applicationId, organizationId],
    );
    if (!rows[0]) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    const store = new PostgresCandidatePipelineStore(createSqlExecutor(client));
    const service = new CandidatePipelineMutationService(store, { next: (p) => `${p}:${crypto.randomUUID()}` }, { now: () => new Date().toISOString() }, { enqueue: async () => {} });
    const result = await service.advance(rows[0], stage as never, String(body.note ?? ""));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update candidate" }, { status: 400 });
  }
}
