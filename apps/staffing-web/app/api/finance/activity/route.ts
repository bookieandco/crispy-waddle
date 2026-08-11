import { NextResponse } from "next/server";
import { getFinanceReadModel } from "@/lib/staffing/finance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const requestedLimit = Number(url.searchParams.get("limit") ?? "50");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 50;
  try {
    const activity = await getFinanceReadModel().activity(organizationId, limit);
    return NextResponse.json({ activity }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load finance activity" }, { status: 500 });
  }
}
