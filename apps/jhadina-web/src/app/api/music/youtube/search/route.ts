import { NextRequest,NextResponse } from "next/server";
import { youtubeOwnerScope,youtubeAuthHttpError } from "@/lib/music/youtube-owner-scope";
import { youtubeDataApiGet,youtubeDiscoveryLimit,mapYouTubeVideos,discoveryErrorResponse } from "@/lib/music/youtube-discovery";

export const runtime="nodejs";export const dynamic="force-dynamic";
const H={"Cache-Control":"private, no-store"};
export async function GET(req:NextRequest) {
  let owner:string;
  try{owner=await youtubeOwnerScope();}
  catch(e){const x=youtubeAuthHttpError(e);return NextResponse.json({error:x.message},{status:x.status,headers:H});}
  const q=(req.nextUrl.searchParams.get("q")||"").trim();
  if(q.length<2||q.length>120)return NextResponse.json({error:"Search must be 2–120 characters."},{status:400,headers:H});
  try{
    youtubeDiscoveryLimit(owner,"search");
    const result=await youtubeDataApiGet<{items?:Array<{
      id?:{videoId?:string};snippet?:{title?:string;channelTitle?:string;thumbnails?:{medium?:{url?:string}}}
    }> }>(req,"search",{part:"snippet",q,type:"video",maxResults:"15",safeSearch:"moderate",videoEmbeddable:"true"},owner);
    const response=NextResponse.json({data:{results:mapYouTubeVideos(result.data.items||[],15),source:"youtube",licensedAudio:false}}, {headers:H});
    if(result.token) response.cookies.set("jhadina_youtube_session",result.token,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/music/youtube",maxAge:60*60*24*30});
    return response;
  }catch(e){const x=discoveryErrorResponse(e);return NextResponse.json({error:x.message},{status:x.status,headers:H});}
}
