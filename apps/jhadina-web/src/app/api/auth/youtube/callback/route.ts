import { NextRequest, NextResponse } from "next/server";
import { exchangeYouTubeCode, youtubeRedirectUri } from "@/lib/youtube-oauth";
import { youtubeCallbackMatchesHost,decodeYoutubeOauthAttempt,validYoutubeOauthState } from "@/lib/music/youtube-oauth-session";
import { serializeYouTubeToken,youtubeSessionFromExchange } from "@/lib/youtube-client";
import { musicYoutubeIsOwnerPreview,youtubeOwnerScope,youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const cookieConfig={httpOnly:true,secure:true,sameSite:"lax" as const,path:"/api/music/youtube"};
export async function GET(req:NextRequest) {
  let owner:string;
  try{owner=await youtubeOwnerScope();}
  catch(e){const x=youtubeAuthHttpError(e);return NextResponse.json({error:x.message},{status:x.status});}
  const state=req.nextUrl.searchParams.get("state")||"";
  const code=req.nextUrl.searchParams.get("code")||"";
  const encrypted=req.cookies.get("jhadina_youtube_oauth_state")?.value;
  const redirectUri=youtubeRedirectUri();
  let valid=false;
  try {valid=Boolean(state&&encrypted&&youtubeCallbackMatchesHost(req.nextUrl.host,redirectUri) &&
    validYoutubeOauthState(decodeYoutubeOauthAttempt(encrypted!),state,owner,redirectUri));}
  catch{/* fail closed */}
  if(!valid)return NextResponse.json({error:"Invalid or expired YouTube OAuth state"},{status:400});
  const dest=musicYoutubeIsOwnerPreview()?"/music/local":"/music";
  if(req.nextUrl.searchParams.has("error")) {
    const response=NextResponse.redirect(new URL(dest+"?youtube=denied",req.url));
    response.cookies.delete("jhadina_youtube_oauth_state");return response;
  }
  if(!code)return NextResponse.json({error:"YouTube authorization code missing"},{status:400});
  try {
    const exchanged=await exchangeYouTubeCode(code);
    const token=youtubeSessionFromExchange(exchanged,owner);
    const response=NextResponse.redirect(new URL(dest+"?youtube=connected",req.url));
    response.cookies.set("jhadina_youtube_session",serializeYouTubeToken(token),{...cookieConfig,maxAge:60*60*24*30});
    response.cookies.delete("jhadina_youtube_oauth_state");
    // Retire earlier bearer-only cookies. Never trust unscopeable legacy tokens.
    response.cookies.set("jhadina_youtube_access","",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
    response.cookies.set("jhadina_youtube_refresh","",{httpOnly:true,secure:true,sameSite:"lax",path:"/api",maxAge:0});
    return response;
  } catch {return NextResponse.redirect(new URL(dest+"?youtube=error",req.url));}
}
