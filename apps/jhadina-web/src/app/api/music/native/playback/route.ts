import { NextRequest, NextResponse } from "next/server";
import { authorizedNativeMusicScope } from "@/lib/music/native-music-auth";
import { musicRouteError } from "@/lib/music/music-route-error";
import { resolveOwnedMusicStorage } from "@/lib/music/music-storage-playback";
import { resolveMusicPlayback } from "@/lib/music/music-catalog-operations";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const trackId = req.nextUrl.searchParams.get("trackId")?.trim();
    if (!trackId || trackId.length > 256)
      return NextResponse.json({success:false,error:"Valid trackId required"},{status:400});
    const { userId, db, repository } = await authorizedNativeMusicScope(req);
    const owned = await resolveOwnedMusicStorage(repository,userId,trackId,{
      async sign(bucket,path,expiry) {
        const {data,error} = await db.storage.from(bucket).createSignedUrl(path,expiry);
        if (error) throw error;
        return data?.signedUrl ?? null;
      },
    });
    // No user-provided URL is admitted. Catalog metadata alone cannot play.
    const fallback = owned ? null : await resolveMusicPlayback(repository,userId,trackId);
    // An authenticated-only private Storage URL cannot be consumed by AVPlayer;
    // owned files must be re-signed as short-lived tickets.
    const ticket = owned ?? (fallback && !fallback.sourceUri.includes("/storage/v1/object/authenticated/music-owned/") ? fallback : null);
    if (!ticket) return NextResponse.json({success:false,error:"No approved audio ticket for this track"},
      {status:404,headers:{"Cache-Control":"no-store"}});
    return NextResponse.json({success:true,data:ticket},
      {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return musicRouteError(error); }
}
