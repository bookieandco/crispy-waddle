import { NextRequest, NextResponse } from "next/server";
import { newOAuthState, youtubeAuthorizationUrl, youtubeRedirectUri, hashState } from "@/lib/youtube-oauth";
import { encodeYoutubeOauthAttempt, youtubeCallbackMatchesHost } from "@/lib/music/youtube-oauth-session";
import { youtubeOwnerScope, youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  try {
    const owner=await youtubeOwnerScope();
    const redirectUri=youtubeRedirectUri();
    if(!youtubeCallbackMatchesHost(req.nextUrl.host,redirectUri)) return NextResponse.json(
      {error:"YouTube OAuth callback for this exact preview hostname is not configured."},{status:503});
    const state=newOAuthState();
    const attempt=encodeYoutubeOauthAttempt({state_hash:hashState(state),owner_id:owner,created_at:Date.now(),redirect_uri:redirectUri});
    const response=NextResponse.redirect(youtubeAuthorizationUrl(state));
    response.cookies.set("jhadina_youtube_oauth_state",attempt,{
      httpOnly:true,secure:true,sameSite:"lax",maxAge:600,path:"/api/auth/youtube"
    });
    return response;
  } catch(e) {const err=youtubeAuthHttpError(e);return NextResponse.json({error:err.message},{status:err.status});}
}
