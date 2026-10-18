import { decryptSecret, encryptSecret, hashState } from "@/lib/youtube-oauth";
export interface YoutubeOauthAttempt {state_hash:string;owner_id:string;created_at:number;redirect_uri:string;}
export function encodeYoutubeOauthAttempt(input:YoutubeOauthAttempt) {return encryptSecret(JSON.stringify(input));}
export function decodeYoutubeOauthAttempt(value:string):YoutubeOauthAttempt {
  const parsed=JSON.parse(decryptSecret(value)) as Partial<YoutubeOauthAttempt>;
  if(!parsed||typeof parsed.state_hash!=="string"||parsed.state_hash.length!==64 ||
     typeof parsed.owner_id!=="string"||typeof parsed.redirect_uri!=="string"||
     !Number.isFinite(parsed.created_at))throw new Error("Malformed YouTube OAuth attempt");
  return parsed as YoutubeOauthAttempt;
}
export function validYoutubeOauthState(saved:YoutubeOauthAttempt,returnedState:string,ownerId:string,redirectUri:string,now=Date.now()):boolean {
  return saved.owner_id===ownerId && saved.redirect_uri===redirectUri && now>=saved.created_at &&
    now-saved.created_at<600_000 && hashState(returnedState)===saved.state_hash;
}
export function youtubeCallbackMatchesHost(requestHost:string,redirectUri:string):boolean {
  try {const url=new URL(redirectUri);return url.protocol==="https:"&&url.host===requestHost&&url.pathname==="/api/auth/youtube/callback";}
  catch{return false;}
}
