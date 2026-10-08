import { NextResponse } from "next/server";
import { PostgresFinanceReadModel } from "../../../../../../packages/staffing-core/src/finance-read-model.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;
    const context = await requireStaffingContext(
      request,
      url.searchParams.get("organizationId") ?? undefined,
    );
    const readModel = new PostgresFinanceReadModel(context.db);
    const activity = await readModel.activity(context.organizationId, limit);
    return NextResponse.json({ activity }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to load finance activity");
  }
}
