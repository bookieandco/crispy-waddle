import { NextResponse } from "next/server";
import { HootsuiteProvider } from "@jhadina/social-core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const provider = new HootsuiteProvider();
    const profiles = await provider.getProfiles();
    return NextResponse.json({ success: true, provider: provider.name, data: profiles });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load social profiles" },
      { status: 503 },
    );
  }
}
