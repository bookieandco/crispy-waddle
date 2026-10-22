import { NextRequest,NextResponse } from "next/server";
import { youtubeOwnerScope,youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";
import { youtubeDataApiGet,youtubeDiscoveryLimit,mapYouTubeVideos,parseYouTubePlaylistId,discoveryErrorResponse } from "@/lib/music/youtube-discovery";

export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest) {
  let owner:string;
  try{owner=await youtubeOwnerScope();}
  catch(e){const x=youtubeAuthHttpError(e);return NextResponse.json({error:x.message},{status:x.status,headers:H});}
  const list=req.nextUrl.searchParams.get("url")||"";
  const id=parseYouTubePlaylistId(list);
  if(!id)return NextResponse.json({error:"Paste a YouTube or YouTube Music playlist link."},{status:400,headers:H});
  const pageToken=req.nextUrl.searchParams.get("pageToken")||"";
  if(pageToken && (pageToken.length>350 || !/^[A-Za-z0-9._~=-]+$/.test(pageToken)))
    return NextResponse.json({error:"Invalid playlist page cursor."},{status:400,headers:H});
  try{
    youtubeDiscoveryLimit(owner,"playlist");
    const params:Record<string,string>={part:"snippet,contentDetails",playlistId:id,maxResults:"50"};
    if(pageToken)params.pageToken=pageToken;
    const outcome=await youtubeDataApiGet<{items?:Array<{
      contentDetails?:{videoId?:string};
      snippet?:{title?:string;videoOwnerChannelTitle?:string;channelTitle?:string;
        resourceId?:{videoId?:string};thumbnails?:{medium?:{url?:string}}}
    }>;nextPageToken?:string;pageInfo?:{totalResults?:number}}>(req,"playlistItems",params,owner);
    const next=outcome.data.nextPageToken;
    const response=NextResponse.json({data:{playlistId:id,items:mapYouTubeVideos(outcome.data.items||[]),
      nextPageToken:typeof next==="string"&&/^[A-Za-z0-9._~=-]{1,350}$/.test(next)?next:null,
      total:Math.min(50000,Math.max(0,Number(outcome.data.pageInfo?.totalResults)||0)),
      source:"youtube",licensedAudio:false}}, {headers:H});
    if(outcome.token)response.cookies.set("jhadina_youtube_session",outcome.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/music/youtube",maxAge:60*60*24*30});
    return response;
  }catch(e){const x=discoveryErrorResponse(e);return NextResponse.json({error:x.message},{status:x.status,headers:H});}
}
