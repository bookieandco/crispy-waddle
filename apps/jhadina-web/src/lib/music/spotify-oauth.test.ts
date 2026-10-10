import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpotifyPending, exchangeSpotifyCode, refreshSpotifyGrant, spotifyAuthorizeUrl, validateSpotifyPending } from "./spotify-oauth";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Spotify PKCE and refresh token lifecycle", () => {
  it("binds challenge and state to an authenticated user", () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID","test-client");
    vi.stubEnv("SPOTIFY_REDIRECT_URI","https://jhadina.example.test/api/auth/spotify/callback");
    const pending = createSpotifyPending("alice", 100);
    const url = new URL(spotifyAuthorizeUrl(pending));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBe(pending.state);
    expect(url.searchParams.get("code_challenge")).not.toBe(pending.verifier);
    expect(() => validateSpotifyPending(pending,pending.state,"bob",100)).toThrow();
    expect(() => validateSpotifyPending(pending,pending.state,"alice",700101)).toThrow();
    expect(() => validateSpotifyPending(pending,pending.state,"alice",400)).not.toThrow();
  });
  it("exchanges authorization code with verifier and preserves refresh token when not rotated", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID","test-client");
    vi.stubEnv("SPOTIFY_REDIRECT_URI","https://jhadina.example.test/api/auth/spotify/callback");
    const calls: URLSearchParams[]=[];
    vi.stubGlobal("fetch",vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(init.body as URLSearchParams);
      return { ok:true, json:async()=>calls.length===1
        ? { access_token:"first", refresh_token:"refresh-1", token_type:"Bearer", expires_in:3600, scope:"playlist-read-private" }
        : { access_token:"next", token_type:"Bearer", expires_in:3600 } };
    }));
    const pending=createSpotifyPending("alice",100);
    const grant=await exchangeSpotifyCode("code",pending,100);
    expect(calls[0].get("code_verifier")).toBe(pending.verifier);
    expect(grant.userId).toBe("alice");
    const renewed=await refreshSpotifyGrant(grant,4000000);
    expect(calls[1].get("grant_type")).toBe("refresh_token");
    expect(renewed.refreshToken).toBe("refresh-1");
    expect(renewed.accessToken).toBe("next");
  });
});
