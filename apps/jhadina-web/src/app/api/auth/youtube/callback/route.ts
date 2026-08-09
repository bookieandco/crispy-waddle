import { NextRequest, NextResponse } from "next/server";
import { exchangeYouTubeCode, encryptSecret, hashState } from "@/lib/youtube-oauth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const expectedState = req.cookies.get("jhadina_youtube_oauth_state")?.value;

  if (error) return NextResponse.redirect(new URL(`/music?youtube=denied&reason=${encodeURIComponent(error)}`, req.url));
  if (!code || !state || !expectedState || hashState(state) !== expectedState) {
    return NextResponse.json({ error: "Invalid YouTube OAuth state" }, { status: 400 });
  }

  try {
    const tokens = await exchangeYouTubeCode(code);
    const response = NextResponse.redirect(new URL("/music?youtube=connected", req.url));
    response.cookies.delete("jhadina_youtube_oauth_state");
    response.cookies.set("jhadina_youtube_access", encryptSecret(tokens.access_token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Math.max(60, (tokens.expires_in ?? 3600) - 60),
      path: "/",
    });
    if (tokens.refresh_token) {
      response.cookies.set("jhadina_youtube_refresh", encryptSecret(tokens.refresh_token), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/api",
      });
    }
    return response;
  } catch {
    return NextResponse.redirect(new URL("/music?youtube=error", req.url));
  }
}
