import { NextResponse } from "next/server";
import { PostgresCommandCenterReadModel } from "../../../../../packages/staffing-core/src/command-center-read-model.js";
import { requireStaffingContext, staffingErrorResponse } from "../../../lib/request-context.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await requireStaffingContext(
      request,
      url.searchParams.get("organizationId") ?? undefined,
    );
    const readModel = new PostgresCommandCenterReadModel(context.db);
    const signals = await readModel.signals(context.organizationId);
    return NextResponse.json({ signals }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return staffingErrorResponse(error, "Unable to load Command Center");
  }
}
