import { NextResponse } from "next/server";
import { PostgresFinanceReadModel } from "../../../../../../packages/staffing-core/src/finance-read-model.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const currency = (url.searchParams.get("currency") ?? "USD").toUpperCase();
  const limit = Number(url.searchParams.get("limit") ?? "50");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  try {
    const client = (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const readModel = new PostgresFinanceReadModel(createSqlExecutor(client));
    return NextResponse.json({ entries: await readModel.ledger(organizationId, currency, limit) }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load ledger" }, { status: 500 }); }
}
