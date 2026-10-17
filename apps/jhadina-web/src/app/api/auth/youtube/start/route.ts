import { NextResponse } from "next/server";
import { encryptSecret, hashState, newOAuthState, youtubeAuthorizationUrl } from "@/lib/youtube-oauth";
import { createRequestIdentityVerifier } from "@/lib/auth/request-identity";

export const runtime = "nodejs";
// Reads GOOGLE_CLIENT_ID (a runtime secret, correctly absent at build time)
// and takes no `req` param, so nothing here trips Next's static-analysis
// heuristic for "this route is dynamic" - it would otherwise try to
// prerender/execute this at build time and fail on the missing env var.
export const dynamic = "force-dynamic";

export async function GET() {
  let userId: string;
  try {
    const verifier = await createRequestIdentityVerifier();
    userId = (await verifier.verify({})).userId;
  } catch {
    return NextResponse.json({ error: "Sign in to Jhadina before connecting YouTube" }, { status: 401 });
  }
  if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.JHADINA_OAUTH_ENCRYPTION_KEY ||
    !(process.env.YOUTUBE_REDIRECT_URI || process.env.NEXT_PUBLIC_APP_URL)) {
    return NextResponse.json({error:"YouTube OAuth is not configured for this environment"},{status:503,headers:{"Cache-Control":"private, no-store"}});
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
  response.cookies.set("jhadina_youtube_oauth_owner", encryptSecret(userId), {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
