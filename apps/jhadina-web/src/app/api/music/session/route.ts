import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";

export const dynamic = "force-dynamic";

/** User identity for scoped browser playback state; never cached or caller-supplied. */
export async function GET() {
  try {
    const { userId } = await authenticatedMusicScope();
    return NextResponse.json({ success: true, data: { userId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return musicRouteError(error);
  }
}
