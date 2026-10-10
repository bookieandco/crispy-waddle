import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { musicCheckpoint } from "@jhadina/music-core";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
    if (!trackId || trackId.length > 256) return NextResponse.json({ success: false, error: "Valid trackId required" }, { status: 400 });
    if (!await repository.getTrack(userId, trackId)) return NextResponse.json({ success: false, error: "Track not found" }, { status: 404 });
    const { createClient } = await import("@/lib/supabase/server");
    const db = await createClient();
    const { data, error } = await db.from("music_playback_checkpoints").select("position_ms,updated_at,completed")
      .eq("user_id", userId).eq("track_id", trackId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ? {
      trackId, positionMs: Number(data.position_ms), updatedAt: data.updated_at, completed: Boolean(data.completed),
    } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return musicRouteError(error); }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) return NextResponse.json({ success: false, error: "Cross-origin write denied" }, { status: 403 });
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ success: false, error: "Invalid checkpoint" }, { status: 400 });
    const body = raw as { trackId?: unknown; positionMs?: unknown };
    if (typeof body.trackId !== "string" || body.trackId.length === 0 || body.trackId.length > 256
      || typeof body.positionMs !== "number" || !Number.isFinite(body.positionMs) || body.positionMs < 0 || body.positionMs > 86400000) {
      return NextResponse.json({ success: false, error: "Invalid checkpoint" }, { status: 400 });
    }
    const track = await repository.getTrack(userId, body.trackId);
    if (!track) return NextResponse.json({ success: false, error: "Track not found" }, { status: 404 });
    const checkpoint = musicCheckpoint(userId, track.id, Math.min(body.positionMs, track.durationMs ?? 86400000), track.durationMs);
    const { createClient } = await import("@/lib/supabase/server");
    const db = await createClient();
    const { error } = await db.from("music_playback_checkpoints").upsert({
      user_id: userId, track_id: checkpoint.trackId, position_ms: checkpoint.positionMs,
      completed: checkpoint.completed, updated_at: checkpoint.updatedAt,
    }, { onConflict: "user_id,track_id" });
    if (error) throw error;
    return NextResponse.json({ success: true, data: checkpoint }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    return musicRouteError(error);
  }
}
