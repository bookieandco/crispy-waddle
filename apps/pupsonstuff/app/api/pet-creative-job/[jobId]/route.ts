import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "pupson-assets";
type RouteContext = { params: Promise<{ jobId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });

  const { data: job, error: jobError } = await supabase
    .from("pupson_creative_jobs")
    .select("id, status, operation, pet_identity_id, output_count, error_message, created_at, started_at, completed_at, updated_at")
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .single();

  if (jobError || !job) return NextResponse.json({ success: false, error: "Creative job not found." }, { status: 404 });

  const { data: rows, error: outputError } = await supabase
    .from("pupson_creative_outputs")
    .select("id, asset_id, output_index, status")
    .eq("creative_job_id", job.id)
    .eq("owner_id", user.id)
    .order("output_index", { ascending: true });

  if (outputError) return NextResponse.json({ success: false, error: outputError.message }, { status: 500 });

  const outputs = await Promise.all((rows ?? []).map(async (row) => {
    const { data: asset } = await supabase
      .from("pupson_media_assets")
      .select("storage_path")
      .eq("id", row.asset_id)
      .eq("owner_id", user.id)
      .single();
    const { data: signed } = asset
      ? await supabase.storage.from(BUCKET).createSignedUrl(asset.storage_path, 3600)
      : { data: null };
    return {
      id: row.id,
      assetId: row.asset_id,
      outputIndex: row.output_index,
      status: row.status,
      uri: asset?.storage_path ?? "",
      signedUrl: signed?.signedUrl,
    };
  }));

  return NextResponse.json({ success: true, job, outputs });
}
