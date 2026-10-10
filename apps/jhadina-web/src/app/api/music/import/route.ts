import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { importYouTubeCatalog, type YouTubeCatalogPayload } from "@/lib/music/music-catalog-operations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Never trust x-user-id or caller-submitted playback rights.
    const { userId, repository } = await authenticatedMusicScope();
    const body = await req.json() as YouTubeCatalogPayload;
    const imported = await importYouTubeCatalog(repository, userId, body);
    return NextResponse.json({ success: true, data: imported }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    return musicRouteError(error);
  }
}
