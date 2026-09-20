import type { IntakeModality } from "@jhadina/intelligence-core";

export type ValidatedUpload = {
  modality: IntakeModality;
  mediaType: string;
  maxBytes: number;
};

const MiB = 1024 * 1024;
export const UNIVERSAL_UPLOAD_LIMITS: Readonly<Record<IntakeModality, number>> = Object.freeze({
  image: 25 * MiB,
  audio: 250 * MiB,
  video: 512 * MiB,
  document: 100 * MiB,
  text: 25 * MiB,
  code: 25 * MiB,
});

export const MAX_UNIVERSAL_UPLOAD_BYTES = UNIVERSAL_UPLOAD_LIMITS.video;

const DECLARED_MEDIA_MODALITY: Readonly<Record<string, IntakeModality>> = Object.freeze({
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/quicktime": "video",
  "video/ogg": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "application/pdf": "document",
  "text/markdown": "document",
  "text/csv": "document",
  "text/plain": "text",
  "application/json": "code",
  "application/javascript": "code",
  "text/javascript": "code",
  "application/typescript": "code",
  "text/typescript": "code",
});

export function validateUniversalUploadDeclaration(input: {
  declaredMediaType: string;
  byteLength: number;
}): ValidatedUpload {
  if (!Number.isInteger(input.byteLength) || input.byteLength <= 0) throw new Error("UPLOAD_BYTE_LENGTH_INVALID");
  if (input.byteLength > MAX_UNIVERSAL_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");
  const mediaType = input.declaredMediaType.split(";")[0]?.trim().toLowerCase();
  if (!mediaType) throw new Error("UPLOAD_MEDIA_TYPE_REQUIRED");
  const modality = DECLARED_MEDIA_MODALITY[mediaType];
  if (!modality) throw new Error("UPLOAD_TYPE_UNSUPPORTED");
  if (input.byteLength > UNIVERSAL_UPLOAD_LIMITS[modality]) {
    throw new Error(`UPLOAD_TOO_LARGE_FOR_${modality.toUpperCase()}`);
  }
  return Object.freeze({ modality, mediaType, maxBytes: UNIVERSAL_UPLOAD_LIMITS[modality] });
}

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.slice(start, end));

const starts = (bytes: Uint8Array, signature: number[]) =>
  signature.every((value, index) => bytes[index] === value);

function isUtf8Text(bytes: Uint8Array): boolean {
  if (bytes.some((value) => value === 0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function validateUniversalUpload(input: {
  declaredMediaType: string;
  bytes: Uint8Array;
}): ValidatedUpload {
  if (!input.bytes.length) throw new Error("UPLOAD_EMPTY");
  if (input.bytes.byteLength > MAX_UNIVERSAL_UPLOAD_BYTES) throw new Error("UPLOAD_TOO_LARGE");

  const mediaType = input.declaredMediaType.split(";")[0]?.trim().toLowerCase();
  if (!mediaType) throw new Error("UPLOAD_MEDIA_TYPE_REQUIRED");

  let modality: IntakeModality | undefined;

  if (starts(input.bytes, [0xff, 0xd8, 0xff]) && mediaType === "image/jpeg") modality = "image";
  else if (starts(input.bytes, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]) && mediaType === "image/png") modality = "image";
  else if (ascii(input.bytes,0,4) === "RIFF" && ascii(input.bytes,8,12) === "WEBP" && mediaType === "image/webp") modality = "image";
  else if (ascii(input.bytes,0,5) === "%PDF-" && mediaType === "application/pdf") modality = "document";
  else if (input.bytes.length >= 12 && ascii(input.bytes,4,8) === "ftyp" && (mediaType === "video/mp4" || mediaType === "video/quicktime")) modality = "video";
  else if (ascii(input.bytes,0,4) === "RIFF" && ascii(input.bytes,8,12) === "WAVE" && (mediaType === "audio/wav" || mediaType === "audio/x-wav")) modality = "audio";
  else if (ascii(input.bytes,0,4) === "OggS" && (mediaType === "audio/ogg" || mediaType === "video/ogg")) modality = mediaType === "video/ogg" ? "video" : "audio";
  else if ((ascii(input.bytes,0,3) === "ID3" || (input.bytes[0] === 0xff && (input.bytes[1] & 0xe0) === 0xe0)) && mediaType === "audio/mpeg") modality = "audio";
  else if (isUtf8Text(input.bytes)) {
    if (["application/json","application/javascript","text/javascript","application/typescript","text/typescript"].includes(mediaType)) modality = "code";
    else if (mediaType === "text/plain") modality = "text";
    else if (["text/markdown","text/csv"].includes(mediaType)) modality = "document";
  }

  if (!modality) throw new Error("UPLOAD_TYPE_MISMATCH_OR_UNSUPPORTED");
  if (input.bytes.byteLength > UNIVERSAL_UPLOAD_LIMITS[modality]) throw new Error(`UPLOAD_TOO_LARGE_FOR_${modality.toUpperCase()}`);

  return Object.freeze({ modality, mediaType, maxBytes: UNIVERSAL_UPLOAD_LIMITS[modality] });
}
