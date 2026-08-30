import { NextRequest, NextResponse } from "next/server";
import { generatePetPortrait, AI_PROMPT_TEMPLATE } from "@/lib/ai";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hotspots } from "@/data/hotspots";
import sharp from "sharp";

export const runtime = "nodejs";

const BUCKET = "pupson-assets";

type RouteContext = { params: Promise<{ jobId: string }> };

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(_request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return errorResponse("Authentication required.", 401);

  const { data: job, error: jobError } = await supabase
    .from("pupson_creative_jobs")
    .select("id, owner_id, pet_identity_id, operation, status, intent, output_count")
    .eq("id", jobId)
    .eq("owner_id", user.id)
    .single();

  if (jobError || !job) return errorResponse("Creative job not found.", 404);
  if (job.status === "completed") return NextResponse.json({ success: true, job });
  if (job.status !== "queued") return errorResponse(`Job is already ${job.status}.`, 409);

  const { data: claimed, error: claimError } = await supabase
    .from("pupson_creative_jobs")
    .update({ status: "generating", started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("owner_id", user.id)
    .eq("status", "queued")
    .select("id, status")
    .single();

  if (claimError || !claimed) return errorResponse("Creative job was claimed by another worker.", 409);

  try {
    if (!job.pet_identity_id) throw new Error("Creative job has no Pet Identity.");

    const { data: identityAssets, error: identityAssetsError } = await supabase
      .from("pupson_pet_identity_assets")
      .select("asset_id, role, sort_order")
      .eq("pet_identity_id", job.pet_identity_id)
      .order("sort_order", { ascending: true });

    if (identityAssetsError || !identityAssets?.length) {
      throw new Error("Pet Identity has no source photos.");
    }

    // The first reference is the current provider's primary subject input.
    // The remaining references remain recorded in the CreativeJob and can be
    // consumed by multi-image providers without changing the job contract.
    const primaryAssetId = identityAssets[0].asset_id;
    const { data: asset, error: assetError } = await supabase
      .from("pupson_media_assets")
      .select("id, storage_path, mime_type, metadata")
      .eq("id", primaryAssetId)
      .eq("owner_id", user.id)
      .single();

    if (assetError || !asset) throw new Error("Primary pet asset could not be loaded.");

    const { data: sourceFile, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(asset.storage_path);

    if (downloadError || !sourceFile) {
      throw new Error(`Pet source download failed: ${downloadError?.message ?? "unknown error"}`);
    }

    const intent = (job.intent ?? {}) as Record<string, unknown>;
    const productId = typeof intent.productId === "string" ? intent.productId : undefined;
    const artStyle = typeof intent.artStyle === "string" && intent.artStyle ? intent.artStyle : "Watercolor";
    const customerPrompt = typeof intent.prompt === "string" ? intent.prompt : "";
    const backgroundMode = typeof intent.backgroundMode === "string" ? intent.backgroundMode : "auto";
    const hotspot = productId ? hotspots.find((item) => item.id === productId) : undefined;

    const backgroundInstruction =
      backgroundMode === "keep"
        ? "Keep the original background."
        : backgroundMode === "generate"
          ? "Create the requested background."
          : backgroundMode === "transparent"
            ? "Use a clean transparent/isolated background with no scene behind the pet."
            : "Isolate the pet and use a transparent/clean background unless the customer explicitly requested a background scene.";

    const result = await generatePetPortrait({
      imageBuffer: Buffer.from(await sourceFile.arrayBuffer()),
      imageFilename: asset.storage_path.split("/").pop() ?? "pet.png",
      imageMimeType: asset.mime_type ?? "image/png",
      basePrompt: `${AI_PROMPT_TEMPLATE}\n${backgroundInstruction}`,
      productPrompt: hotspot?.aiTemplate,
      artStyleLabel: artStyle,
      userPrompt: customerPrompt,
      outputCount: job.output_count,
    });

    if (!result.success) throw new Error(result.error);

    const outputs: Array<{ id: string; assetId: string; uri: string }> = [];

    for (let index = 0; index < result.imagesBase64.length; index += 1) {
      const assetId = crypto.randomUUID();
      const outputId = crypto.randomUUID();
      const buffer = Buffer.from(result.imagesBase64[index], "base64");
      const metadata = await sharp(buffer).metadata();
      const path = `pet-assets/${user.id}/${job.pet_identity_id}/generated/${job.id}/${outputId}.png`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: "image/png",
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw new Error(`Generated asset upload failed: ${uploadError.message}`);

      const { error: assetInsertError } = await supabase
        .from("pupson_media_assets")
        .insert({
          id: assetId,
          owner_id: user.id,
          kind: "generated",
          storage_path: path,
          mime_type: "image/png",
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          metadata: {
            source: "creative-job-runner",
            creativeJobId: job.id,
            outputIndex: index,
            petIdentityId: job.pet_identity_id,
          },
        });
      if (assetInsertError) throw new Error(`Generated asset record failed: ${assetInsertError.message}`);

      const { error: outputInsertError } = await supabase
        .from("pupson_creative_outputs")
        .insert({
          id: outputId,
          creative_job_id: job.id,
          owner_id: user.id,
          asset_id: assetId,
          output_index: index,
          status: "available",
          metadata: { mimeType: "image/png", width: metadata.width, height: metadata.height },
        });
      if (outputInsertError) throw new Error(`Creative output record failed: ${outputInsertError.message}`);

      outputs.push({
        id: outputId,
        assetId,
        uri: path,
      });
    }

    const { data: completedJob, error: completeError } = await supabase
      .from("pupson_creative_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", job.id)
      .eq("owner_id", user.id)
      .select("id, status, output_count, completed_at")
      .single();

    if (completeError || !completedJob) throw new Error("Creative job completion update failed.");

    return NextResponse.json({ success: true, job: completedJob, outputs });
  } catch (error) {
    await supabase
      .from("pupson_creative_jobs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Creative job failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("owner_id", user.id);

    return errorResponse(
      error instanceof Error ? error.message : "Creative job failed.",
      502
    );
  }
}
