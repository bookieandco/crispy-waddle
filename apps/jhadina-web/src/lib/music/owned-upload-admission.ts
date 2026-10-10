/**
 * A signed upload is storage intake, NEVER proof of streaming/redistribution rights.
 * Only a separately reviewed privileged ingest may grant playback authorization.
 */
export interface OwnedAudioUploadInput {
  filename: string; mimeType: string; sizeBytes: number; rightsConfirmed: boolean;
}
export interface PlannedOwnedAudioUpload {
  bucket: "music-owned"; path: string; mimeType: string; sizeBytes: number;
  status: "pending_rights_review"; playbackAuthorized: false;
}
const extensions: Record<string,string[]> = {
  "audio/mpeg": ["mp3"], "audio/mp4": ["m4a"],
  "audio/x-m4a": ["m4a"], "audio/wav": ["wav"],
  "audio/x-wav": ["wav"], "audio/flac": ["flac"],
  "audio/ogg": ["ogg", "opus"], "audio/aac": ["aac"],
};
export function planOwnedAudioUpload(
  userId: string, input: OwnedAudioUploadInput, fileId: string,
): PlannedOwnedAudioUpload {
  if (!/^[a-f0-9-]{36}$/i.test(userId) || !/^[a-f0-9-]{36}$/i.test(fileId))
    throw new Error("Invalid authenticated upload identity");
  if (!input || typeof input.filename !== "string" || typeof input.mimeType !== "string"
    || !Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0
    || input.sizeBytes > 50 * 1024 * 1024 || input.rightsConfirmed !== true)
    throw new Error("An audio file (up to 50 MB) and ownership/permission attestation are required");
  const ext = input.filename.toLowerCase().split(".").pop() ?? "";
  const accepted = extensions[input.mimeType.toLowerCase()];
  if (!accepted?.includes(ext)) throw new Error("Audio file extension and MIME type do not match");
  return { bucket: "music-owned", path: `${userId}/${fileId}.${ext}`,
    mimeType: input.mimeType.toLowerCase(), sizeBytes: input.sizeBytes,
    status: "pending_rights_review", playbackAuthorized: false };
}
