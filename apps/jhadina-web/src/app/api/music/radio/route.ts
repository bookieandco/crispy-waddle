import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { listCuratedRadioStations } from "@/lib/music/radio-directory";
import { musicRouteError } from "@/lib/music/music-route-error";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const stations = await listCuratedRadioStations(repository, userId);
    return NextResponse.json({ success: true, data: { stations } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return musicRouteError(error); }
}
