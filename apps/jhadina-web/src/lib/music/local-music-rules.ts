export const LOCAL_MUSIC_MAX_BYTES = 100 * 1024 * 1024;
export const LOCAL_MUSIC_MAX_BATCH = 20;
const AUDIO_EXTENSION = /\.(mp3|m4a|aac|wav|ogg|opus|flac|aiff|aif)$/i;

/** Offline owner-selected audio stays in the browser; metadata here grants no cloud playback rights. */
export function localMusicFileError(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!file.name || file.name.length > 240 || file.name.includes("\0")) return "Invalid file name.";
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > LOCAL_MUSIC_MAX_BYTES)
    return "Audio file must be between 1 byte and 100 MB.";
  const mime = file.type.toLowerCase();
  if (!AUDIO_EXTENSION.test(file.name) || (mime && !mime.startsWith("audio/") && mime !== "application/ogg"))
    return "Select a supported audio file (MP3, M4A, WAV, FLAC, AAC, OGG).";
  return null;
}
export function localMusicTitle(name: string): string {
  return name.replace(/\.(mp3|m4a|aac|wav|ogg|opus|flac|aiff|aif)$/i, "").replace(/_/g, " ").trim();
}
