import { NextResponse } from "next/server";
import { PostgresFinanceReadModel } from "../../../../../../packages/staffing-core/src/finance-read-model.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../../lib/request-context.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const currency = (url.searchParams.get("currency") ?? "USD").toUpperCase();
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const context = await requireStaffingContext(
      request,
      url.searchParams.get("organizationId") ?? undefined,
    );
    const readModel = new PostgresFinanceReadModel(context.db);
    return NextResponse.json(
      { entries: await readModel.ledger(context.organizationId, currency, limit) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return staffingErrorResponse(error, "Unable to load ledger");
  }
}
