/**
 * Inventory is read-only and never interprets an uploaded object as licensed,
 * approved, processed or ready for playback. Raw paths and signed URLs stay server-side.
 */
export interface UploadedAudioObject {
  name: string;
  id?: string | null;
  created_at?: string | null;
  metadata?: { size?: unknown } | null;
}
export interface UploadedAudioSummary {
  fileId: string;
  fileType: string;
  uploadedAt?: string;
  bytes?: number;
  status: "awaiting_independent_review";
  playbackAuthorized: false;
}
const ENTRY = /^([a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\.(mp3|m4a|wav|flac|ogg|opus|aac)$/i;
export function summarizeOwnedUploads(objects: UploadedAudioObject[]): UploadedAudioSummary[] {
  if (!Array.isArray(objects)) throw new Error("Invalid owner storage listing");
  const result: UploadedAudioSummary[] = [];
  const seen = new Set<string>();
  for (const object of objects.slice(0, 100)) {
    const match = typeof object.name === "string" ? object.name.match(ENTRY) : null;
    if (!match || seen.has(object.name)) continue;
    seen.add(object.name);
    const bytes = object.metadata?.size;
    const uploadedAt = object.created_at;
    result.push({
      fileId: match[1],
      fileType: match[2].toLowerCase(),
      ...(typeof bytes === "number" && Number.isSafeInteger(bytes) && bytes >= 0 ? { bytes } : {}),
      ...(typeof uploadedAt === "string" && Number.isFinite(Date.parse(uploadedAt)) ? { uploadedAt } : {}),
      status: "awaiting_independent_review", playbackAuthorized: false,
    });
  }
  return result;
}
