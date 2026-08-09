import { NextResponse } from "next/server";
import { hashState, newOAuthState, youtubeAuthorizationUrl } from "@/lib/youtube-oauth";

export const runtime = "nodejs";
// Reads GOOGLE_CLIENT_ID (a runtime secret, correctly absent at build time)
// and takes no `req` param, so nothing here trips Next's static-analysis
// heuristic for "this route is dynamic" - it would otherwise try to
// prerender/execute this at build time and fail on the missing env var.
export const dynamic = "force-dynamic";

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
