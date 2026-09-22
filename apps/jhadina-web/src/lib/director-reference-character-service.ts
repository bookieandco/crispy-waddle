import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  planCharacterReferenceBootstrap,
  type CharacterCastRecord,
  type CharacterReferenceBootstrapPlan,
} from '@jhadina/director-core';
import { saveDirectorCastRecord } from '@/lib/director-cast-repository';

const MAX_REFERENCE_FILES = 3;
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_NORMALIZED_BYTES = 25 * 1024 * 1024;
const MIN_DIMENSION = 512;
const MAX_DIMENSION = 16_384;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type DirectorReferenceUpload = {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
};

export type DirectorReferenceMedia = {
  id: string;
  assetId: string;
  objectPath: string;
  originalSha256: string;
  normalizedSha256: string;
  width: number;
  height: number;
  mimeType: 'image/png';
};

export type DirectorReferenceCharacterResult = {
  projectId: string;
  characterId: string;
  cast: CharacterCastRecord;
  bootstrapPlan: CharacterReferenceBootstrapPlan;
  references: readonly DirectorReferenceMedia[];
};

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function safePathSegment(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160) || 'reference';
}

function normalizeArchetype(value: string): CharacterCastRecord['archetype'] {
  if (value === 'cartoon' || value === 'puppet' || value === 'creature') return value;
  return 'human';
}

export async function sanitizeDirectorReferenceImage(upload: DirectorReferenceUpload): Promise<{
  bytes: Buffer;
  width: number;
  height: number;
  decodedMimeType: string;
}> {
  if (!ALLOWED_MIME.has(upload.mimeType)) {
    throw new Error('DIRECTOR_REFERENCE_MIME_UNSUPPORTED');
  }
  if (!upload.bytes.length || upload.bytes.length > MAX_SOURCE_BYTES) {
    throw new Error('DIRECTOR_REFERENCE_SIZE_INVALID');
  }

  const sharp = (await import('sharp')).default;
  const image = sharp(upload.bytes, {
    failOn: 'error',
    limitInputPixels: MAX_DIMENSION * MAX_DIMENSION,
    sequentialRead: true,
  });
  const metadata = await image.metadata();
  const decodedMimeType =
    metadata.format === 'jpeg' ? 'image/jpeg' :
    metadata.format === 'png' ? 'image/png' :
    metadata.format === 'webp' ? 'image/webp' :
    undefined;

  if (!decodedMimeType || decodedMimeType !== upload.mimeType) {
    throw new Error('DIRECTOR_REFERENCE_MIME_MISMATCH');
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION
  ) {
    throw new Error('DIRECTOR_REFERENCE_DIMENSIONS_INVALID');
  }

  // Decode -> auto-orient -> lossless PNG re-encode. Sharp does not preserve
  // arbitrary source metadata by default, so the stored object contains only
  // decoded pixels rather than the original container/payload.
  const normalized = await image
    .rotate()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  if (!normalized.length || normalized.length > MAX_NORMALIZED_BYTES) {
    throw new Error('DIRECTOR_REFERENCE_NORMALIZED_SIZE_INVALID');
  }

  return { bytes: normalized, width, height, decodedMimeType };
}

export async function createDirectorReferenceCharacter(
  client: SupabaseClient,
  input: {
    userId: string;
    projectId: string;
    characterId: string;
    displayName: string;
    archetype: string;
    rightsRef: string;
    consentRef: string;
    files: readonly DirectorReferenceUpload[];
  },
): Promise<DirectorReferenceCharacterResult> {
  const projectId = input.projectId.trim();
  const characterId = safePathSegment(input.characterId);
  const displayName = input.displayName.trim().slice(0, 120);
  const rightsRef = input.rightsRef.trim().slice(0, 500);
  const consentRef = input.consentRef.trim().slice(0, 500);

  if (!projectId || !characterId || !displayName) {
    throw new Error('DIRECTOR_REFERENCE_CHARACTER_IDENTITY_REQUIRED');
  }
  if (!rightsRef) throw new Error('DIRECTOR_REFERENCE_RIGHTS_REQUIRED');
  if (!consentRef) throw new Error('DIRECTOR_REFERENCE_CONSENT_REQUIRED');
  if (!input.files.length || input.files.length > MAX_REFERENCE_FILES) {
    throw new Error('DIRECTOR_REFERENCE_FILE_COUNT_INVALID');
  }

  const now = new Date().toISOString();
  const references: DirectorReferenceMedia[] = [];

  for (const upload of input.files) {
    const sanitized = await sanitizeDirectorReferenceImage(upload);
    const id = `reference:${randomUUID()}`;
    const objectPath = [
      'references',
      safePathSegment(input.userId),
      safePathSegment(projectId),
      characterId,
      `${id.replace(':', '_')}.png`,
    ].join('/');
    const originalDigest = sha256(upload.bytes);
    const normalizedDigest = sha256(sanitized.bytes);

    const { error: uploadError } = await client.storage
      .from('director-media')
      .upload(objectPath, sanitized.bytes, {
        contentType: 'image/png',
        upsert: false,
        cacheControl: '3600',
      });
    if (uploadError) throw new Error(`DIRECTOR_REFERENCE_STORAGE_FAILED:${uploadError.message}`);

    const sanitizationReceipt = {
      status: 'passed',
      policy: 'director-image-decode-reencode-v1',
      sourceMimeType: upload.mimeType,
      decodedMimeType: sanitized.decodedMimeType,
      normalizedMimeType: 'image/png',
      metadataPreserved: false,
      sourceBytesPersisted: false,
      checkedAt: now,
    };

    const { error: rowError } = await client.from('director_reference_media').insert({
      id,
      project_id: projectId,
      character_id: characterId,
      uploaded_by_user_id: input.userId,
      bucket_id: 'director-media',
      object_path: objectPath,
      original_filename: upload.fileName.slice(0, 255) || 'reference',
      original_mime_type: upload.mimeType,
      normalized_mime_type: 'image/png',
      original_byte_size: upload.bytes.length,
      normalized_byte_size: sanitized.bytes.length,
      width: sanitized.width,
      height: sanitized.height,
      original_sha256: originalDigest,
      normalized_sha256: normalizedDigest,
      rights_ref: rightsRef,
      consent_ref: consentRef,
      admission_status: 'admitted',
      sanitization_receipt: sanitizationReceipt,
      admitted_at: now,
    });

    if (rowError) {
      await client.storage.from('director-media').remove([objectPath]);
      throw new Error(`DIRECTOR_REFERENCE_PERSIST_FAILED:${rowError.message}`);
    }

    references.push({
      id,
      assetId: id,
      objectPath,
      originalSha256: originalDigest,
      normalizedSha256: normalizedDigest,
      width: sanitized.width,
      height: sanitized.height,
      mimeType: 'image/png',
    });
  }

  const bootstrapPlan = planCharacterReferenceBootstrap({
    id: `bootstrap:${projectId}:${characterId}`,
    projectId,
    characterId,
    displayName,
    archetype: normalizeArchetype(input.archetype),
    uploads: references.map((reference, index) => ({
      id: reference.id,
      assetId: reference.assetId,
      sha256: reference.normalizedSha256,
      width: reference.width,
      height: reference.height,
      view: index === 0 ? 'unknown' : 'unknown',
      rightsRef,
      consentRef,
      evidenceIds: [`sanitization:${reference.id}`],
    })),
    buildMotionProbes: true,
    commercialUse: true,
  });

  const baseAppearanceId = `${characterId}:base`;
  const cast: CharacterCastRecord = {
    id: `cast:${projectId}:${characterId}`,
    projectId,
    characterId,
    displayName,
    archetype: normalizeArchetype(input.archetype),
    continuityRef: bootstrapPlan.continuityRef,
    canonicalAppearanceVariantId: baseAppearanceId,
    appearanceVariants: [{
      id: baseAppearanceId,
      characterId,
      kind: 'base',
      label: 'Approved reference identity',
      referenceAssetIds: references.map((reference) => reference.assetId),
      referenceSha256s: references.map((reference) => reference.normalizedSha256),
      approvedAt: now,
      approvedBy: input.userId,
    }],
    lockedTraits: ['visual identity must remain consistent with approved reference assets'],
    approvedAt: now,
    approvedBy: input.userId,
  };

  await saveDirectorCastRecord(client, { cast, approvedByUserId: input.userId });

  return Object.freeze({
    projectId,
    characterId,
    cast,
    bootstrapPlan,
    references: Object.freeze(references),
  });
}
