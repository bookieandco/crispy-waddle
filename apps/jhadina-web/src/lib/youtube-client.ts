import { decryptSecret, encryptSecret } from "./youtube-oauth";

export const YOUTUBE_API="https://www.googleapis.com/youtube/v3";
export interface YouTubeSession {
  access_token:string;
  refresh_token?:string;
  expires_at:number;
  owner_id:string;
  token_type:"Bearer";
}
export function serializeYouTubeToken(token: YouTubeSession): string {
  return encryptSecret(JSON.stringify(token));
}
export function deserializeYouTubeToken(value:string):YouTubeSession {
  const token=JSON.parse(decryptSecret(value)) as Partial<YouTubeSession>;
  if(!token||typeof token.access_token!=="string"||token.access_token.length<5 ||
    typeof token.owner_id!=="string"||!token.owner_id||token.token_type!=="Bearer"||
    !Number.isSafeInteger(token.expires_at)||token.expires_at<=0 ||
    (token.refresh_token!==undefined&&typeof token.refresh_token!=="string")){
    throw new Error("Invalid YouTube session");
  }
  return token as YouTubeSession;
}
export function youtubeSessionFromExchange(
  exchanged:{access_token:string;refresh_token?:string;expires_in?:number;token_type?:string},owner:string,now=Date.now()
):YouTubeSession {
  if(!owner||!exchanged.access_token||exchanged.token_type && exchanged.token_type.toLowerCase()!=="bearer") throw new Error("Invalid OAuth exchange");
  const expiry=Math.max(60,Math.min(3600,Number(exchanged.expires_in)||3600));
  return {access_token:exchanged.access_token,refresh_token:exchanged.refresh_token,expires_at:now+expiry*1000,owner_id:owner,token_type:"Bearer"};
}
function required(name:string):string {
  const value=process.env[name];if(!value)throw new Error("YouTube connection is not configured");
  return value;
}
export async function refreshYouTubeToken(token:YouTubeSession,now=Date.now()):Promise<YouTubeSession> {
  if(token.expires_at>now+60_000)return token;
  if(!token.refresh_token)throw new Error("YouTube authorization expired; reconnect your account.");
  const result=await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({client_id:required("GOOGLE_CLIENT_ID"),client_secret:required("GOOGLE_CLIENT_SECRET"),
      refresh_token:token.refresh_token,grant_type:"refresh_token"}),cache:"no-store",
  });
  if(!result.ok)throw new Error("YouTube authorization expired; reconnect your account.");
  const data=await result.json() as {access_token?:string;expires_in?:number;token_type?:string};
  if(!data.access_token || data.token_type && data.token_type.toLowerCase()!=="bearer")throw new Error("Invalid refresh response");
  return {...token,access_token:data.access_token,expires_at:now+Math.max(60,Math.min(3600,Number(data.expires_in)||3600))*1000};
}
export async function authorizedYouTubeFetch<T>(encryptedToken:string,path:"search"|"playlistItems",params:Record<string,string>,ownerId:string):
  Promise<{data:T;encryptedToken:string}> {
  const old=deserializeYouTubeToken(encryptedToken);
  if(old.owner_id!==ownerId)throw new Error("YouTube account session owner changed");
  const token=await refreshYouTubeToken(old);
  const url=new URL(YOUTUBE_API+"/"+path);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  const response=await fetch(url.toString(),{headers:{Authorization:"Bearer "+token.access_token},cache:"no-store"});
  if(!response.ok)throw new Error("YouTube API request unsuccessful ("+response.status+")");
  return {data:await response.json() as T,encryptedToken:serializeYouTubeToken(token)};
}
export type YouTubeSearchResponse={items:Array<{id:{videoId?:string};snippet:{title:string;channelTitle:string;description:string}}>} ;
export function mapYouTubeSearchToMusicInput(response:YouTubeSearchResponse) {
 return response.items.flatMap(item=>item.id.videoId?[{videoId:item.id.videoId,title:item.snippet.title,artists:[item.snippet.channelTitle]}]:[]);
}
