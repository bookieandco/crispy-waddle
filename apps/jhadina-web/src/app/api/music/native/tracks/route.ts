import { NextRequest, NextResponse } from "next/server";
import { authorizedNativeMusicScope } from "@/lib/music/native-music-auth";
import { musicRouteError } from "@/lib/music/music-route-error";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { userId, repository } = await authorizedNativeMusicScope(req);
    const tracks = (await repository.listTracks(userId)).slice(0, 100);
    return NextResponse.json({success:true,data:{
      tracks: tracks.map(t=>({id:t.id,title:t.title,artist:"Jhadina Music"})),
      playlistCertified:false,
    }},{headers:{"Cache-Control":"no-store"}});
  } catch(error) { return musicRouteError(error); }
}
