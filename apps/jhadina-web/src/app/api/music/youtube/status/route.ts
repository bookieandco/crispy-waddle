import { NextRequest, NextResponse } from "next/server";
import { deserializeYouTubeToken } from "@/lib/youtube-client";
import { youtubeOwnerScope,youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const CACHE={"Cache-Control":"private, no-store"};
/** Exposes only whether a server-side integration is configured. Never return a key or OAuth secret. */
export async function GET(req:NextRequest) {
  let owner:string;
  try { owner=await youtubeOwnerScope(); }
  catch(e) {const x=youtubeAuthHttpError(e);return NextResponse.json({connected:false,error:x.message},{status:x.status,headers:CACHE});}
  const capability={
    publicSearchAvailable:Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim()||process.env.GOOGLE_YOUTUBE_API_KEY?.trim()),
    oauthAvailable:Boolean(process.env.GOOGLE_CLIENT_ID?.trim()&&process.env.GOOGLE_CLIENT_SECRET?.trim()&&
      process.env.JHADINA_OAUTH_ENCRYPTION_KEY?.trim()&&process.env.YOUTUBE_REDIRECT_URI?.trim())
  };
  const blob=req.cookies.get("jhadina_youtube_session")?.value;
  if(!blob)return NextResponse.json({connected:false,reason:"not_connected",...capability},{headers:CACHE});
  try {
    const token=deserializeYouTubeToken(blob);
    const connected=token.owner_id===owner&&(token.expires_at>Date.now()||Boolean(token.refresh_token));
    return NextResponse.json({connected,provider:"youtube",reason:connected?"connected":"expired",...capability},{headers:CACHE});
  }catch{
    return NextResponse.json({connected:false,reason:"expired_or_invalid",...capability},{headers:CACHE});
  }
}
