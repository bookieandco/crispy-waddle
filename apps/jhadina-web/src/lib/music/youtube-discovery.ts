import type { NextRequest } from "next/server";
import { YOUTUBE_API,authorizedYouTubeFetch,deserializeYouTubeToken } from "@/lib/youtube-client";

type Endpoint="search"|"playlistItems";
export class YouTubeDiscoveryError extends Error {constructor(public status:number,message:string){super(message);}}
const counters=new Map<string,{since:number,count:number}>();
const resultCache=new Map<string,{expires:number,data:unknown}>();
const TTL_MS=90_000;
/** Per-instance limit is a second guard, not globally coordinated billing quota enforcement.
 * Search requests are user submitted; do not auto-query or auto-paginate. */
export function youtubeDiscoveryLimit(owner:string,route:string,now=Date.now()):void {
  const key=owner+":"+route;
  const count=counters.get(key);
  if(!count||now-count.since>=60_000){counters.set(key,{since:now,count:1});return;}
  if(count.count >= (route==="search"?8:18)) throw new YouTubeDiscoveryError(429,"Too many searches. Try again shortly.");
  count.count++;
  if(counters.size>500){const first=counters.keys().next().value;if(first)counters.delete(first);}
}
export async function youtubeDataApiGet<T>(req:NextRequest,endpoint:Endpoint,params:Record<string,string>,owner:string):
  Promise<{data:T;token?:string;source:"youtube-api"}> {
  const cookie=req.cookies.get("jhadina_youtube_session")?.value;
  const key=process.env.YOUTUBE_DATA_API_KEY?.trim()||process.env.GOOGLE_YOUTUBE_API_KEY?.trim();
  if(!key&&!cookie)throw new YouTubeDiscoveryError(503,"YouTube discovery needs an approved API key or a connected YouTube account.");
  const cacheKey=owner+"|"+endpoint+"|"+JSON.stringify(params);
  const cached=resultCache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return {data:cached.data as T,source:"youtube-api"};
  try {
    let data:T,token:string|undefined;
    if(cookie){
      const ownerSession=deserializeYouTubeToken(cookie);
      if(ownerSession.owner_id!==owner)throw new YouTubeDiscoveryError(401,"Connected YouTube account does not match this session.");
      const outcome=await authorizedYouTubeFetch<T>(cookie,endpoint,params,owner);
      data=outcome.data;token=outcome.encryptedToken;
    } else {
      const url=new URL(YOUTUBE_API+"/"+endpoint);
      Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
      url.searchParams.set("key",key!);
      const response=await fetch(url.toString(),{cache:"no-store"});
      if(response.status===403||response.status===429)throw new YouTubeDiscoveryError(429,"YouTube quota or access limit reached.");
      if(!response.ok)throw new YouTubeDiscoveryError(503,"YouTube discovery is unavailable ("+response.status+").");
      data=await response.json() as T;
    }
    resultCache.set(cacheKey,{data,expires:Date.now()+TTL_MS});
    if(resultCache.size>100){const first=resultCache.keys().next().value;if(first)resultCache.delete(first);}
    return {data,token,source:"youtube-api"};
  } catch(e) {
    if(e instanceof YouTubeDiscoveryError)throw e;
    throw new YouTubeDiscoveryError(503,"YouTube discovery is unavailable. Reconnect the account or check provider configuration.");
  }
}
export interface YoutubeVideo {
  id:string;title:string;artist:string;thumbnail?:string;source:"youtube";
}
const ID=/^[a-zA-Z0-9_-]{11}$/;
function safeThumbnail(input:unknown):string|undefined{
  if(typeof input!=="string")return undefined;
  try {const u=new URL(input);if(u.protocol==="https:"&&
    (u.hostname==="i.ytimg.com"||u.hostname==="img.youtube.com"||u.hostname==="yt3.ggpht.com"))return u.toString();}
  catch {/* ignored */}
  return undefined;
}
type Item={id?:{videoId?:string};contentDetails?:{videoId?:string};snippet?:{
  title?:string;channelTitle?:string;videoOwnerChannelTitle?:string;resourceId?:{videoId?:string};
  thumbnails?:{medium?:{url?:string};default?:{url?:string}}}};
export function mapYouTubeVideos(items:Item[],max=50):YoutubeVideo[]{
  const seen=new Set<string>(), result:YoutubeVideo[]=[];
  for(const item of items||[]){
    const id=item.id?.videoId||item.contentDetails?.videoId||item.snippet?.resourceId?.videoId;
    if(!id||!ID.test(id)||seen.has(id))continue;
    const title=(item.snippet?.title||"").trim().slice(0,180);
    if(!title||title==="Deleted video"||title==="Private video")continue;
    seen.add(id);result.push({id,title,artist:(item.snippet?.videoOwnerChannelTitle||
      item.snippet?.channelTitle||"YouTube").trim().slice(0,120),
      thumbnail:safeThumbnail(item.snippet?.thumbnails?.medium?.url||item.snippet?.thumbnails?.default?.url),
      source:"youtube"});
    if(result.length>=max)break;
  }
  return result;
}
export function parseYouTubePlaylistId(input:string):string|null{
  if(!input||input.length>2048)return null;
  let url:URL;
  try{url=new URL(input.trim());}catch{return null;}
  if(url.protocol!=="https:"||url.port||url.username||url.password||
    !["music.youtube.com","youtube.com","www.youtube.com","m.youtube.com"].includes(url.hostname.toLowerCase()))
    return null;
  if(!["/playlist","/watch"].includes(url.pathname))return null;
  const id=url.searchParams.get("list");
  return id&&/^[A-Za-z0-9_-]{10,120}$/.test(id)?id:null;
}
export function discoveryErrorResponse(error:unknown):{status:number;message:string}{
  if(error instanceof YouTubeDiscoveryError)return {status:error.status,message:error.message};
  return {status:503,message:"YouTube discovery temporarily unavailable."};
}
