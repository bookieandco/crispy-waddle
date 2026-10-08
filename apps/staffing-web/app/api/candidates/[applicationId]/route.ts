import { NextResponse } from "next/server";
import { TransactionalCandidatePipelineService } from "../../../../../../packages/staffing-core/src/transactional-candidate-pipeline.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  try {
    const body = await request.json();
    const applicationId = (await context.params).applicationId;
    if (!applicationId) return NextResponse.json({ error: "Missing candidate context" }, { status: 400 });

    const auth = await requireStaffingContext(request, body.organizationId);
    const rows = await auth.db.query<any>(
      `select id, organization_id as "organizationId", job_id as "jobId", worker_id as "workerId", status,
              cover_note as "coverNote", created_at as "createdAt", updated_at as "updatedAt"
       from staffing_applications where id = $1 and organization_id = $2 limit 1`,
      [applicationId, auth.organizationId],
    );
    if (!rows[0]) return NextResponse.json({ error: "Application not found" }, { status: 404 });

    const service = new TransactionalCandidatePipelineService(
      auth.db,
      { next: (prefix) => `${prefix}:${crypto.randomUUID()}` },
      { now: () => new Date().toISOString() },
    );
    const result = await service.advance(rows[0], String(body.stage) as never, String(body.note ?? ""));
    return NextResponse.json(result);
  } catch (error) {
    return staffingErrorResponse(error, "Unable to update candidate", 400);
  }
}
