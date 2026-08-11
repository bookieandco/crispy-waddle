import { NextResponse } from "next/server";
import { getCommandCenterReadModel } from "@/lib/staffing/command-center";

export async function GET(request: Request) {
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  if (!organizationId) return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  try {
    const signals = await getCommandCenterReadModel().signals(organizationId);
    return NextResponse.json({ signals }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Command Center" }, { status: 500 });
  }
}
