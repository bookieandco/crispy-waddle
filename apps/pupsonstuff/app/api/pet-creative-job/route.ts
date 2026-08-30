import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PHOTOS = 5;
const MAX_BYTES_PER_PHOTO = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "pupson-assets";

type BackgroundMode = "auto" | "transparent" | "keep" | "generate";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function safeExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Sign in is required before saving a pet identity.", 401);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Expected multipart/form-data.");
  }

  const files = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File);

  if (files.length === 0) return jsonError("Add at least one pet photo.");
  if (files.length > MAX_PHOTOS) {
    return jsonError(`You can add up to ${MAX_PHOTOS} pet photos.`);
  }

  const petNameRaw = form.get("petName");
  const petName =
    typeof petNameRaw === "string" && petNameRaw.trim()
      ? petNameRaw.trim().slice(0, 80)
      : "My Pet";

  const productIdRaw = form.get("productId");
  const productId =
    typeof productIdRaw === "string" && productIdRaw.trim()
      ? productIdRaw.trim().slice(0, 120)
      : undefined;

  const promptRaw = form.get("prompt");
  const prompt = typeof promptRaw === "string" ? promptRaw.trim().slice(0, 2000) : "";

  const artStyleRaw = form.get("artStyle");
  const artStyle = typeof artStyleRaw === "string" ? artStyleRaw.trim().slice(0, 120) : "";

  const backgroundRaw = form.get("backgroundMode");
  const backgroundMode: BackgroundMode =
    backgroundRaw === "transparent" ||
    backgroundRaw === "keep" ||
    backgroundRaw === "generate"
      ? backgroundRaw
      : "auto";

  const outputCountRaw = Number(form.get("outputCount") ?? 3);
  const outputCount = Number.isFinite(outputCountRaw)
    ? Math.min(8, Math.max(1, Math.floor(outputCountRaw)))
    : 3;

  for (const file of files) {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      return jsonError(`Unsupported image type: ${file.type}`);
    }
    if (file.size <= 0 || file.size > MAX_BYTES_PER_PHOTO) {
      return jsonError("Each pet photo must be between 1 byte and 10MB.");
    }
  }

  const storagePaths: string[] = [];
  const assetIds: string[] = [];
  let petId: string | null = null;
  let jobId: string | null = null;

  try {
    // The bucket is private. Every object is owner-scoped in its path so
    // Storage RLS can authorize it without consulting application tables.
    for (const file of files) {
      const assetId = crypto.randomUUID();
      const path = `pet-assets/${user.id}/pending/${assetId}.${safeExtension(file)}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const dimensions = await sharp(buffer).metadata();

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }
      storagePaths.push(path);

      const { error: assetError } = await supabase
        .from("pupson_media_assets")
        .insert({
          id: assetId,
          owner_id: user.id,
          kind: "original",
          storage_path: path,
          mime_type: file.type,
          width: dimensions.width ?? null,
          height: dimensions.height ?? null,
          metadata: {
            originalFilename: file.name,
            sizeBytes: file.size,
            source: "pupsonstuff-pet-uploader",
          },
        });

      if (assetError) {
        throw new Error(`Asset record failed: ${assetError.message}`);
      }
      assetIds.push(assetId);
    }

    const { data: pet, error: petError } = await supabase
      .from("pupson_pet_identities")
      .insert({
        owner_id: user.id,
        name: petName,
        primary_asset_id: assetIds[0],
        metadata: { source: "pupsonstuff", photoCount: assetIds.length },
      })
      .select("id, name, primary_asset_id")
      .single();

    if (petError || !pet) {
      throw new Error(`Pet identity creation failed: ${petError?.message ?? "unknown error"}`);
    }
    petId = pet.id;

    const durablePaths: string[] = [];
    for (let index = 0; index < assetIds.length; index += 1) {
      const assetId = assetIds[index];
      const currentPath = storagePaths[index];
      const nextPath = `pet-assets/${user.id}/${pet.id}/${assetId}.${safeExtension(files[index])}`;

      const { error: moveError } = await supabase.storage.from(BUCKET).move(currentPath, nextPath);
      if (moveError) {
        throw new Error(`Storage finalization failed: ${moveError.message}`);
      }

      storagePaths.push(nextPath);
      durablePaths.push(nextPath);

      const { error: assetUpdateError } = await supabase
        .from("pupson_media_assets")
        .update({ storage_path: nextPath })
        .eq("id", assetId)
        .eq("owner_id", user.id);

      if (assetUpdateError) {
        throw new Error(`Asset finalization failed: ${assetUpdateError.message}`);
      }
    }

    const { error: identityAssetError } = await supabase
      .from("pupson_pet_identity_assets")
      .insert(
        assetIds.map((assetId, index) => ({
          pet_identity_id: pet.id,
          asset_id: assetId,
          role: "reference",
          sort_order: index,
        }))
      );

    if (identityAssetError) {
      throw new Error(`Pet photo association failed: ${identityAssetError.message}`);
    }

    const intent = {
      operation: "generate_product_design",
      productId,
      prompt,
      artStyle,
      backgroundMode,
      backgroundDefault: backgroundMode === "auto" ? "transparent" : backgroundMode,
      references: assetIds.map((assetId) => ({ assetId, role: "subject" })),
      outputCount,
      source: "pupsonstuff",
    };

    const { data: job, error: jobError } = await supabase
      .from("pupson_creative_jobs")
      .insert({
        owner_id: user.id,
        pet_identity_id: pet.id,
        operation: "generate_image",
        status: "queued",
        intent,
        output_count: outputCount,
      })
      .select("id, status, operation, pet_identity_id, output_count, created_at")
      .single();

    if (jobError || !job) {
      throw new Error(`Creative job enqueue failed: ${jobError?.message ?? "unknown error"}`);
    }
    jobId = job.id;

    return NextResponse.json({
      success: true,
      petIdentity: pet,
      assetIds,
      job,
      storagePaths: durablePaths,
    });
  } catch (error) {
    if (jobId) {
      await supabase.from("pupson_creative_jobs").delete().eq("id", jobId).eq("owner_id", user.id);
    }
    if (petId) {
      await supabase.from("pupson_pet_identity_assets").delete().eq("pet_identity_id", petId);
      await supabase.from("pupson_pet_identities").delete().eq("id", petId).eq("owner_id", user.id);
    }
    if (assetIds.length > 0) {
      await supabase.from("pupson_media_assets").delete().in("id", assetIds).eq("owner_id", user.id);
    }
    if (storagePaths.length > 0) {
      await supabase.storage.from(BUCKET).remove([...new Set(storagePaths)]).catch(() => undefined);
    }

    return jsonError(
      error instanceof Error ? error.message : "Unable to create the pet identity.",
      500
    );
  }
}
