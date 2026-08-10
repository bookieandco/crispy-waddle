import type { SupabaseClient } from "@supabase/supabase-js";
import { addCreationAsset } from "./assets";

const BUCKET = "pupson-assets";

export async function uploadOriginalPetPhoto(supabase: SupabaseClient, input: { creationId: string; file: File }) {
  if (!input.file.type.startsWith("image/")) throw new Error("Pet photo must be an image.");
  if (input.file.size > 10 * 1024 * 1024) throw new Error("Pet photo must be 10 MB or smaller.");

  const ext = input.file.type === "image/png" ? "png" : input.file.type === "image/webp" ? "webp" : "jpg";
  const path = `${input.creationId}/original/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;

  return addCreationAsset(supabase, { creationId: input.creationId, kind: "original-photo", storagePath: path, mimeType: input.file.type });
}
