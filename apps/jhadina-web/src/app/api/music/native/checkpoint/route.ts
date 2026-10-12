import { NextRequest, NextResponse } from "next/server";
import { musicCheckpoint } from "@jhadina/music-core";
import { authorizedNativeMusicScope } from "@/lib/music/native-music-auth";
import { musicRouteError } from "@/lib/music/music-route-error";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  try {
    const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
    if (!trackId || trackId.length > 256)
      return NextResponse.json({success:false,error:"Valid trackId required"},{status:400});
    const {userId,db,repository}=await authorizedNativeMusicScope(req);
    if (!await repository.getTrack(userId,trackId))
      return NextResponse.json({success:false,error:"Track not found"},{status:404});
    const {data,error}=await db.from("music_playback_checkpoints").select("position_ms")
      .eq("user_id",userId).eq("track_id",trackId).maybeSingle();
    if(error) throw error;
    return NextResponse.json({success:true,data:{positionMs:Math.max(0,Number(data?.position_ms ?? 0))}},
      {headers:noStore});
  } catch(error) { return musicRouteError(error); }
}

export async function POST(req: NextRequest) {
  try {
    const raw:unknown=await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      return NextResponse.json({success:false,error:"Invalid checkpoint"},{status:400});
    const body=raw as Record<string,unknown>;
    if(typeof body.trackId !== "string" || !body.trackId || body.trackId.length > 256
      || typeof body.positionMs !== "number" || !Number.isFinite(body.positionMs)
      || !Number.isInteger(body.positionMs) || body.positionMs < 0 || body.positionMs > 86400000)
      return NextResponse.json({success:false,error:"Invalid checkpoint"},{status:400});
    const {userId,db,repository}=await authorizedNativeMusicScope(req);
    const track=await repository.getTrack(userId,body.trackId);
    if (!track) return NextResponse.json({success:false,error:"Track not found"},{status:404});
    const next=musicCheckpoint(userId,track.id,Math.min(body.positionMs,track.durationMs??86400000),track.durationMs);
    const {error}=await db.from("music_playback_checkpoints").upsert({
      user_id:userId,track_id:track.id,position_ms:next.positionMs,
      completed:next.completed,updated_at:next.updatedAt,
    },{onConflict:"user_id,track_id"});
    if(error)throw error;
    return NextResponse.json({success:true,data:{positionMs:next.positionMs}},{headers:noStore});
  } catch(error) {
    if(error instanceof SyntaxError)
      return NextResponse.json({success:false,error:"Invalid JSON"},{status:400});
    return musicRouteError(error);
  }
}
