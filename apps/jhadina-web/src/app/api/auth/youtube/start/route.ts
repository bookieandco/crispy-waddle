import { NextResponse } from "next/server";
import { hashState, newOAuthState, youtubeAuthorizationUrl } from "@/lib/youtube-oauth";

export const runtime = "nodejs";

export async function GET() {
  const state = newOAuthState();
  const response = NextResponse.redirect(youtubeAuthorizationUrl(state));
  response.cookies.set("jhadina_youtube_oauth_state", hashState(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
