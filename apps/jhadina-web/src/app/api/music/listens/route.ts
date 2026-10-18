import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { resolveMusicPlayback } from "@/lib/music/music-catalog-operations";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Only first-party player reports are ingested, never third-party streaming/royalty claims.
  const origin = req.headers.get("origin");
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ success: false, error: "Cross-origin event denied" }, { status: 403 });
  }
  try {
    const { userId, repository } = await authenticatedMusicScope();
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ success: false, error: "Invalid listening event" }, { status: 400 });
    }
    const body = raw as { trackId?: unknown; sessionId?: unknown; startedAt?: unknown; positionMs?: unknown };
    if (typeof body.trackId !== "string" || !body.trackId || body.trackId.length > 256
      || typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)
      || typeof body.startedAt !== "string"
      || typeof body.positionMs !== "number" || !Number.isFinite(body.positionMs) || body.positionMs < 0) {
      return NextResponse.json({ success: false, error: "Invalid listening event" }, { status: 400 });
    }
    const now = Date.now();
    const started = Date.parse(body.startedAt);
    if (!Number.isFinite(started) || started > now || now - started > 6 * 60 * 60 * 1000) {
      return NextResponse.json({ success: false, error: "Invalid listening session time" }, { status: 400 });
    }
    // Catalog identity and an authorized playback asset are mandatory; never treat plays as verified royalties.
    if (!await resolveMusicPlayback(repository, userId, body.trackId)) {
      return NextResponse.json({ success: false, error: "No playable track" }, { status: 404 });
    }
    const track = await repository.getTrack(userId, body.trackId);
    const positionMs = Math.min(Math.round(body.positionMs), track?.durationMs ?? 6 * 60 * 60 * 1000);
    await repository.recordListeningEvent({
      id: `web:${body.sessionId}`, userId, trackId: body.trackId,
      startedAt: new Date(started).toISOString(), endedAt: new Date(now).toISOString(),
      positionMs, completed: true, skipped: false,
    });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    return musicRouteError(error);
  }
}
