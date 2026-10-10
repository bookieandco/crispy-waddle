import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { searchMusicCatalog } from "@/lib/music/music-catalog-operations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ success: false, error: "Query parameter 'q' is required" }, { status: 400 });
  if (query.length > 200) return NextResponse.json({ success: false, error: "Search query too long" }, { status: 400 });
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const results = await searchMusicCatalog(repository, userId, query);
    return NextResponse.json({ success: true, data: { results, count: results.length } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return musicRouteError(error);
  }
}
