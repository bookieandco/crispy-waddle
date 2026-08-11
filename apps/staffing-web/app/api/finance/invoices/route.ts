import { NextResponse } from "next/server";
import { getFinanceReadModel } from "@/lib/staffing/finance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const currency = (url.searchParams.get("currency") ?? "USD").toUpperCase();
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  try {
    const invoices = await getFinanceReadModel().invoices(organizationId, currency);
    return NextResponse.json({ invoices }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load invoices" }, { status: 500 });
  }
}
