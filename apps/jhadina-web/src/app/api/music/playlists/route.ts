import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";

export const dynamic = "force-dynamic";

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  return !!origin && origin === req.nextUrl.origin;
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ success: false, error: "Cross-origin write denied" }, { status: 403 });
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Invalid playlist data" }, { status: 400 });
    }
    const input = body as { id?: unknown; name?: unknown; trackIds?: unknown };
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (!name || name.length > 120 || !Array.isArray(input.trackIds)
      || input.trackIds.length > 500 || !input.trackIds.every(id => typeof id === "string" && id.length > 0 && id.length <= 256)) {
      return NextResponse.json({ success: false, error: "Valid name and up to 500 track IDs required" }, { status: 400 });
    }
    const uniqueIds = [...new Set(input.trackIds as string[])];
    const owned = new Set((await repository.listTracks(userId)).map(track => track.id));
    if (uniqueIds.some(id => !owned.has(id))) {
      return NextResponse.json({ success: false, error: "Playlist contains an unavailable track" }, { status: 400 });
    }
    const requestedId = typeof input.id === "string" ? input.id : undefined;
    if (requestedId && !/^user:[0-9a-f-]{36}$/.test(requestedId)) {
      return NextResponse.json({ success: false, error: "Invalid playlist ID" }, { status: 400 });
    }
    if (requestedId && !await repository.getPlaylist(userId, requestedId)) {
      return NextResponse.json({ success: false, error: "Playlist not found" }, { status: 404 });
    }
    const playlist = await repository.upsertPlaylist(userId, {
      id: requestedId ?? `user:${crypto.randomUUID()}`, ownerUserId: userId, name, trackIds: uniqueIds,
    });
    return NextResponse.json({ success: true, data: playlist }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    return musicRouteError(error);
  }
}
