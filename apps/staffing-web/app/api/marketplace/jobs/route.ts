import { NextResponse } from "next/server";
import { MarketplaceJobQueryService } from "../../../../../../../packages/staffing-core/src/marketplace-query.js";
import { PostgresMarketplaceJobReader } from "../../../../../../../packages/staffing-core/src/postgres-marketplace-reader.js";
import { createSqlExecutor } from "../../../../lib/postgres.js";

export const runtime = "nodejs";

function databaseClient() {
  return (globalThis as typeof globalThis & { STAFFING_SQL?: Parameters<typeof createSqlExecutor>[0] }).STAFFING_SQL;
}

export async function GET(request: Request) {
  try {
    const client = databaseClient();
    if (!client) return NextResponse.json({ error: "Staffing database adapter is not configured" }, { status: 503 });
    const url = new URL(request.url);
    const reader = new PostgresMarketplaceJobReader(createSqlExecutor(client));
    const service = new MarketplaceJobQueryService(reader);
    const result = await service.search({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      location: url.searchParams.get("location") ?? undefined,
      remote: url.searchParams.has("remote") ? url.searchParams.get("remote") === "true" : undefined,
      currency: url.searchParams.get("currency") ?? undefined,
      minPayRate: url.searchParams.has("minPayRate") ? Number(url.searchParams.get("minPayRate")) : undefined,
      maxPayRate: url.searchParams.has("maxPayRate") ? Number(url.searchParams.get("maxPayRate")) : undefined,
      limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to query marketplace jobs";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
