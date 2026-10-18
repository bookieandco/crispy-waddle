import { NextRequest, NextResponse } from "next/server";
import { deserializeYouTubeToken } from "@/lib/youtube-client";
import { youtubeOwnerScope,youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  try {
    const owner=await youtubeOwnerScope();
    const blob=req.cookies.get("jhadina_youtube_session")?.value;
    if(!blob)return NextResponse.json({connected:false,reason:"not_connected"},{headers:{"Cache-Control":"no-store"}});
    const token=deserializeYouTubeToken(blob);
    const connected=token.owner_id===owner && (token.expires_at>Date.now()||!!token.refresh_token);
    return NextResponse.json({connected,provider:"youtube",reason:connected?"connected":"expired"},{headers:{"Cache-Control":"no-store"}});
  } catch(e) {const x=youtubeAuthHttpError(e);return NextResponse.json({connected:false,error:x.message},{status:x.status});}
}
