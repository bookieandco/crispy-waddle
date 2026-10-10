import { NextResponse } from "next/server";
import { authenticatedMusicScope } from "@/lib/music/music-request-scope";
import { musicRouteError } from "@/lib/music/music-route-error";
import { createClient } from "@/lib/supabase/server";
import { summarizeOwnedUploads } from "@/lib/music/owned-upload-inventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Signed-in user's private objects only; statuses are not rights grants. */
export async function GET() {
  try {
    const { userId } = await authenticatedMusicScope();
    const db = await createClient();
    const { data, error } = await db.storage.from("music-owned")
      .list(userId, { limit:100, sortBy: { column:"created_at", order:"desc" } });
    if (error) throw error;
    return NextResponse.json({ success:true, data: { uploads:summarizeOwnedUploads(data ?? []),
      certification:"unverified_private_intake_only" } },
      { headers: { "Cache-Control":"no-store" } });
  } catch(error) { return musicRouteError(error); }
}
