import { NextResponse } from "next/server";
import { CandidatePipelineQueryService } from "../../../../../packages/staffing-core/src/candidate-pipeline-query.js";
import { PostgresCandidatePipelineReader } from "../../../../../packages/staffing-core/src/postgres-candidate-pipeline-reader.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../lib/request-context.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await requireStaffingContext(
      request,
      url.searchParams.get("organizationId") ?? undefined,
    );
    const service = new CandidatePipelineQueryService(
      new PostgresCandidatePipelineReader(context.db),
    );
    const result = await service.list({
      organizationId: context.organizationId,
      jobId: url.searchParams.get("jobId") ?? undefined,
      stage: (url.searchParams.get("stage") as never) ?? undefined,
      searchWorkerId: url.searchParams.get("workerId") ?? undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return staffingErrorResponse(error, "Unable to query candidates", 400);
  }
}
