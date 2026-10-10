import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { planOwnedAudioUpload } from "@/lib/music/owned-upload-admission";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ success:false, error:"Cross-origin uploads are not allowed" }, { status:403 });
  try {
    const { userId } = await authenticatedMusicScope();
    const input: unknown = await req.json();
    if (!input || typeof input !== "object" || Array.isArray(input))
      return NextResponse.json({ success:false, error:"Valid audio file details required" }, { status:400 });
    let planned;
    try {
      const v = input as Record<string,unknown>;
      planned = planOwnedAudioUpload(userId,{
        filename:v.filename as string, mimeType:v.mimeType as string,
        sizeBytes:v.sizeBytes as number, rightsConfirmed:v.rightsConfirmed as boolean,
      },randomUUID());
    } catch {
      return NextResponse.json({ success:false, error:"Invalid or unapproved audio upload request" }, { status:400 });
    }
    const db = await createClient();
    const { data, error } = await db.storage.from(planned.bucket)
      .createSignedUploadUrl(planned.path, { upsert:false });
    if (error || !data?.token)
      return NextResponse.json({ success:false, error:"Owned audio upload storage is unavailable" },
        { status:503, headers:{"Cache-Control":"no-store"} });
    // The signed token is scoped to exactly one object name. It does not authorize
    // music_sources or music_assets writes, public streaming or commercial reuse.
    return NextResponse.json({ success:true, data:{
      bucket:planned.bucket,path:planned.path,token:data.token,
      status:planned.status,playbackAuthorized:false,
    } },{ headers:{"Cache-Control":"no-store"} });
  } catch(error) {
    if(error instanceof SyntaxError)
      return NextResponse.json({success:false,error:"Invalid JSON"},{status:400});
    return musicRouteError(error);
  }
}
