import { NextResponse } from "next/server";
import { getFinanceReadModel } from "@/lib/staffing/finance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const currency = (url.searchParams.get("currency") ?? "USD").toUpperCase();
  const limit = Number(url.searchParams.get("limit") ?? "50");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  try { return NextResponse.json({ entries: await getFinanceReadModel().ledger(organizationId, currency, limit) }, { headers: { "cache-control": "no-store" } }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load ledger" }, { status: 500 }); }
}
