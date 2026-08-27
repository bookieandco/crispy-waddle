import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { buildSpotifyAuthorizeUrl, createSpotifyOAuthState, spotifyStateCookieName } from "../../../../../lib/music/spotify-oauth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const origin = new URL(request.url).origin;
  const state = createSpotifyOAuthState();
  const response = NextResponse.redirect(buildSpotifyAuthorizeUrl(origin, state));
  response.cookies.set(spotifyStateCookieName(), state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
