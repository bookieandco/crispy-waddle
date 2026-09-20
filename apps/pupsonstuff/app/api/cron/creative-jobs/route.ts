import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generatePetPortrait, AI_PROMPT_TEMPLATE } from "@/lib/ai";
import { hotspots } from "@/data/hotspots";
import sharp from "sharp";

export const runtime = "nodejs";

const BUCKET = "pupson-assets";
const MAX_JOBS_PER_RUN = 3;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase worker credentials are not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  const expected = process.env.CREATIVE_WORKER_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || supplied !== expected) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });

  const supabase = admin();
  const { data: jobs, error } = await supabase
    .from("pupson_creative_jobs")
    .select("id, owner_id, pet_identity_id, status, intent, output_count")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const results: Array<{ jobId: string; status: string; outputs?: number; error?: string }> = [];

  for (const job of jobs ?? []) {
    const { data: claimed } = await supabase
      .from("pupson_creative_jobs")
      .update({ status: "generating", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      if (!job.pet_identity_id) throw new Error("Creative job has no Pet Identity.");
      const { data: refs, error: refsError } = await supabase
        .from("pupson_pet_identity_assets")
        .select("asset_id, role, sort_order")
        .eq("pet_identity_id", job.pet_identity_id)
        .order("sort_order", { ascending: true });
      if (refsError || !refs?.length) throw new Error("Pet Identity has no source photos.");

      const primary = refs[0].asset_id;
      const { data: asset, error: assetError } = await supabase
        .from("pupson_media_assets")
        .select("id, storage_path, mime_type")
        .eq("id", primary)
        .eq("owner_id", job.owner_id)
        .single();
      if (assetError || !asset) throw new Error("Primary pet asset could not be loaded.");
      const { data: source, error: downloadError } = await supabase.storage.from(BUCKET).download(asset.storage_path);
      if (downloadError || !source) throw new Error("Pet source download failed.");

      const intent = (job.intent ?? {}) as Record<string, unknown>;
      const productId = typeof intent.productId === "string" ? intent.productId : undefined;
      const artStyle = typeof intent.artStyle === "string" && intent.artStyle ? intent.artStyle : "Watercolor";
      const customerPrompt = typeof intent.prompt === "string" ? intent.prompt : "";
      const backgroundMode = typeof intent.backgroundMode === "string" ? intent.backgroundMode : "auto";
      const hotspot = productId ? hotspots.find((item) => item.id === productId) : undefined;
      const backgroundInstruction = backgroundMode === "keep" ? "Keep the original background." : backgroundMode === "generate" ? "Create the requested background." : backgroundMode === "transparent" ? "Use a clean transparent/isolated background with no scene behind the pet." : "Isolate the pet and use a transparent/clean background unless the customer explicitly requested a background scene.";

      const result = await generatePetPortrait({
        imageBuffer: Buffer.from(await source.arrayBuffer()),
        imageFilename: asset.storage_path.split("/").pop() ?? "pet.png",
        imageMimeType: asset.mime_type ?? "image/png",
        basePrompt: `${AI_PROMPT_TEMPLATE}\n${backgroundInstruction}`,
        productPrompt: hotspot?.aiTemplate,
        artStyleLabel: artStyle,
        userPrompt: customerPrompt,
        outputCount: Math.min(3, Math.max(1, job.output_count ?? 3)),
      });
      if (!result.success) throw new Error(result.error);

      for (let index = 0; index < result.imagesBase64.length; index += 1) {
        const outputId = crypto.randomUUID();
        const assetId = crypto.randomUUID();
        const buffer = Buffer.from(result.imagesBase64[index], "base64");
        const metadata = await sharp(buffer).metadata();
        const path = `pet-assets/${job.owner_id}/${job.pet_identity_id}/generated/${job.id}/${outputId}.png`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: "image/png", cacheControl: "31536000", upsert: false });
        if (uploadError) throw new Error(`Generated asset upload failed: ${uploadError.message}`);
        const { error: assetInsertError } = await supabase.from("pupson_media_assets").insert({ id: assetId, owner_id: job.owner_id, kind: "generated", storage_path: path, mime_type: "image/png", width: metadata.width ?? null, height: metadata.height ?? null, metadata: { source: "creative-worker", creativeJobId: job.id, outputIndex: index } });
        if (assetInsertError) throw new Error(`Generated asset record failed: ${assetInsertError.message}`);
        const { error: outputError } = await supabase.from("pupson_creative_outputs").insert({ id: outputId, creative_job_id: job.id, owner_id: job.owner_id, asset_id: assetId, output_index: index, status: "available", metadata: { mimeType: "image/png", width: metadata.width, height: metadata.height } });
        if (outputError) throw new Error(`Creative output record failed: ${outputError.message}`);
      }

      await supabase.from("pupson_creative_jobs").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString(), error_message: null }).eq("id", job.id).eq("status", "generating");
      results.push({ jobId: job.id, status: "completed", outputs: result.imagesBase64.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Creative job failed.";
      await supabase.from("pupson_creative_jobs").update({ status: "failed", error_message: message.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "generating");
      results.push({ jobId: job.id, status: "failed", error: message });
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results });
}
