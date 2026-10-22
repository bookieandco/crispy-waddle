import { describe,it,expect,beforeAll,afterAll } from "vitest";
import { youtubeSessionFromExchange,serializeYouTubeToken,deserializeYouTubeToken } from "./youtube-client";
import { hashState } from "./youtube-oauth";
import { validYoutubeOauthState,youtubeCallbackMatchesHost } from "./music/youtube-oauth-session";
describe("YouTube OAuth owner/session token contract",()=>{
  const previous=process.env.JHADINA_OAUTH_ENCRYPTION_KEY;
  beforeAll(()=>{process.env.JHADINA_OAUTH_ENCRYPTION_KEY="test-only-not-an-auth-secret";});
  afterAll(()=>{if(previous===undefined)delete process.env.JHADINA_OAUTH_ENCRYPTION_KEY;else process.env.JHADINA_OAUTH_ENCRYPTION_KEY=previous;});
  it("roundtrips an owner-bound expiring encrypted token",()=>{
    const data=youtubeSessionFromExchange({access_token:"some-token-value",expires_in:3500,token_type:"Bearer"},"owner-01",1000);
    expect(deserializeYouTubeToken(serializeYouTubeToken(data))).toEqual(data);
    expect(()=>deserializeYouTubeToken("garbage")).toThrow();
  });
  it("rejects forged, expired and wrong-owner OAuth state",()=>{
    const state="abcvxyz";
    const saved={state_hash:hashState(state),owner_id:"owner-01",created_at:1000,
      redirect_uri:"https://preview.example/api/auth/youtube/callback"};
    expect(validYoutubeOauthState(saved,state,"owner-01",saved.redirect_uri,2000)).toBe(true);
    expect(validYoutubeOauthState(saved,state,"owner-02",saved.redirect_uri,2000)).toBe(false);
    expect(validYoutubeOauthState(saved,state,"owner-01",saved.redirect_uri,602000)).toBe(false);
    expect(youtubeCallbackMatchesHost("preview.example",saved.redirect_uri)).toBe(true);
    expect(youtubeCallbackMatchesHost("evil.example",saved.redirect_uri)).toBe(false);
  });
});
