import { NextResponse } from "next/server";
import { CandidatePipelineQueryService } from "../../../../../packages/staffing-core/src/candidate-pipeline-query.js";
import { PostgresCandidatePipelineReader } from "../../../../../packages/staffing-core/src/postgres-candidate-pipeline-reader.js";
import { createSqlExecutor } from "../../../lib/postgres.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const organizationId = request.headers.get("x-organization-id");
    if (!organizationId) return NextResponse.json({ error: "Missing organization context" }, { status: 401 });
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const url = new URL(request.url);
    const service = new CandidatePipelineQueryService(new PostgresCandidatePipelineReader(createSqlExecutor(client)));
    const result = await service.list({
      organizationId,
      jobId: url.searchParams.get("jobId") ?? undefined,
      stage: (url.searchParams.get("stage") as never) ?? undefined,
      searchWorkerId: url.searchParams.get("workerId") ?? undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query candidates";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
