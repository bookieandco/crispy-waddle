import { NextResponse } from "next/server";
import { PostgresCommandCenterReadModel } from "../../../../../packages/staffing-core/src/command-center-read-model.js";
import { createSqlExecutor } from "../../../lib/postgres.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  try {
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const readModel = new PostgresCommandCenterReadModel(createSqlExecutor(client));
    const signals = await readModel.signals(organizationId);
    return NextResponse.json({ signals }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Command Center" }, { status: 500 });
  }
}
