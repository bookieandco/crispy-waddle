import { NextResponse } from "next/server";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";
import { hashState, newOAuthState, youtubeAuthorizationUrl } from "@/lib/youtube-oauth";

export const runtime = "nodejs";
// Reads GOOGLE_CLIENT_ID (a runtime secret, correctly absent at build time)
// and takes no `req` param, so nothing here trips Next's static-analysis
// heuristic for "this route is dynamic" - it would otherwise try to
// prerender/execute this at build time and fail on the missing env var.
export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  try {
    userId = (await (await createRequestIdentityVerifier()).verify({})).userId;
    if (!userId) throw new Error("UNAUTHORIZED");
  } catch {
    return NextResponse.json({ error: "Sign in before connecting YouTube." }, { status: 401 });
  }
  const state = newOAuthState();
  const response = NextResponse.redirect(youtubeAuthorizationUrl(state));
  response.cookies.set("jhadina_youtube_oauth_state", hashState(state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  // Bind the existing state cookie to the owner who began OAuth.
  response.cookies.set("jhadina_youtube_oauth_owner", hashState(userId + ":" + state), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
