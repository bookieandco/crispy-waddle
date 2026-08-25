import { NextRequest, NextResponse } from "next/server";
import { musicRepository } from "../../../../lib/music/repository";
import { tracksToFeedItems } from "../../../../lib/personal-feed/music";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "user_demo";
  const tracks = await musicRepository.listTracks(userId);
  return NextResponse.json({ success: true, data: tracksToFeedItems(tracks).slice(0, 20) });
}
