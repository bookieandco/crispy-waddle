export const DIRECTOR_REFERENCE_MAX_BYTES = 20 * 1024 * 1024;
export const DIRECTOR_REFERENCE_MIN_DIMENSION = 128;
export const DIRECTOR_REFERENCE_MAX_DIMENSION = 16_384;

export type DirectorReferenceMime = 'image/jpeg' | 'image/png' | 'image/webp';

export type DirectorReferenceInspection = {
  mimeType: DirectorReferenceMime;
  width: number;
  height: number;
};

export type DirectorReferenceScanResult = {
  clean: boolean;
  safe: boolean;
  evidenceIds: string[];
  reason?: string;
};

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
}

function u16be(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function u16le(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function dimensionsPng(bytes: Uint8Array): { width: number; height: number } | undefined {
  const signature = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
  if (bytes.length < 24 || signature.some((value,index) => bytes[index] !== value)) return undefined;
  if (ascii(bytes,12,4) !== 'IHDR') return undefined;
  return { width: u32be(bytes,16), height: u32be(bytes,20) };
}

function dimensionsJpeg(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset++]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 1 >= bytes.length) break;
    const segmentLength = u16be(bytes,offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    const sof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof && segmentLength >= 7) {
      return { height: u16be(bytes,offset + 3), width: u16be(bytes,offset + 5) };
    }
    offset += segmentLength;
  }
  return undefined;
}

function dimensionsWebp(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 30 || ascii(bytes,0,4) !== 'RIFF' || ascii(bytes,8,4) !== 'WEBP') return undefined;
  const chunk = ascii(bytes,12,4);
  if (chunk === 'VP8X' && bytes.length >= 30) {
    return { width: 1 + u24le(bytes,24), height: 1 + u24le(bytes,27) };
  }
  if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) {
    const b1 = bytes[21]!, b2 = bytes[22]!, b3 = bytes[23]!, b4 = bytes[24]!;
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
    };
  }
  if (chunk === 'VP8 ' && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: u16le(bytes,26) & 0x3fff, height: u16le(bytes,28) & 0x3fff };
  }
  return undefined;
}

export function inspectDirectorReferenceImage(
  bytes: Uint8Array,
  claimedMimeType: string,
): DirectorReferenceInspection {
  if (!bytes.length || bytes.length > DIRECTOR_REFERENCE_MAX_BYTES) {
    throw new Error('DIRECTOR_REFERENCE_FILE_SIZE_INVALID');
  }

  let detected: DirectorReferenceInspection | undefined;
  const png = dimensionsPng(bytes);
  if (png) detected = { mimeType: 'image/png', ...png };
  const jpeg = detected ? undefined : dimensionsJpeg(bytes);
  if (jpeg) detected = { mimeType: 'image/jpeg', ...jpeg };
  const webp = detected ? undefined : dimensionsWebp(bytes);
  if (webp) detected = { mimeType: 'image/webp', ...webp };

  if (!detected) throw new Error('DIRECTOR_REFERENCE_IMAGE_SIGNATURE_INVALID');
  if (detected.mimeType !== claimedMimeType) throw new Error('DIRECTOR_REFERENCE_MIME_MISMATCH');
  if (
    detected.width < DIRECTOR_REFERENCE_MIN_DIMENSION ||
    detected.height < DIRECTOR_REFERENCE_MIN_DIMENSION ||
    detected.width > DIRECTOR_REFERENCE_MAX_DIMENSION ||
    detected.height > DIRECTOR_REFERENCE_MAX_DIMENSION
  ) throw new Error('DIRECTOR_REFERENCE_DIMENSIONS_INVALID');

  return detected;
}

export async function scanDirectorReferenceMedia(input: {
  signedUrl: string;
  sha256: string;
  mimeType: DirectorReferenceMime;
  byteSize: number;
}): Promise<DirectorReferenceScanResult> {
  const endpoint = process.env.DIRECTOR_MEDIA_SCANNER_URL?.trim();
  if (!endpoint) throw new Error('DIRECTOR_MEDIA_SCANNER_NOT_CONFIGURED');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.DIRECTOR_MEDIA_SCANNER_TOKEN
          ? { authorization: `Bearer ${process.env.DIRECTOR_MEDIA_SCANNER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        url: input.signedUrl,
        sha256: input.sha256,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        requiredChecks: ['malware','image-safety'],
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`DIRECTOR_MEDIA_SCANNER_HTTP_${response.status}`);
    const raw = await response.json() as {
      clean?: boolean;
      safe?: boolean;
      evidenceIds?: unknown;
      reason?: unknown;
    };
    if (typeof raw.clean !== 'boolean' || typeof raw.safe !== 'boolean') {
      throw new Error('DIRECTOR_MEDIA_SCANNER_RESPONSE_INVALID');
    }
    const evidenceIds = Array.isArray(raw.evidenceIds)
      ? raw.evidenceIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    if (!evidenceIds.length) throw new Error('DIRECTOR_MEDIA_SCANNER_EVIDENCE_REQUIRED');
    return {
      clean: raw.clean,
      safe: raw.safe,
      evidenceIds,
      ...(typeof raw.reason === 'string' && raw.reason.trim() ? { reason: raw.reason.trim() } : {}),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function safeDirectorReferenceFilename(name: string): string {
  const normalized = name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^[.-]+|[-.]+$/g,'');
  return normalized.slice(0,120) || 'reference-image';
}
