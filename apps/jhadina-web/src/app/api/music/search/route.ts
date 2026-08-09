import { NextRequest, NextResponse } from "next/server";
import { InMemoryMusicRepository, searchTracks } from "@jhadina/music-core";

const music = new InMemoryMusicRepository();

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "user_demo";
  const query = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!query) return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
  const tracks = await music.listTracks(userId);
  const results = searchTracks(tracks, query);
  return NextResponse.json({ success: true, data: { results, count: results.length } });
}
