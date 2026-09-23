import { createHash } from 'node:crypto';
import type { AskVideoCreationIntent } from './ask-video-production';

export const DIRECTOR_PAID_VIDEO_GENERATION_CAPABILITY = 'director.video.generate.paid' as const;

export interface DirectorPaidVideoGenerationFingerprintInput {
  jobId: string;
  userId: string;
  projectId: string;
  providerId: string;
  prompt: string;
  intent: Pick<AskVideoCreationIntent, 'mode' | 'aspectRatio' | 'targetDurationSeconds'>;
  character?: {
    characterId: string;
    continuityRef: string;
    appearanceVariantId: string;
    referenceSha256s: readonly string[];
  };
  product?: {
    productId: string;
    productBibleId: string;
    canonicalVariantId: string;
    referenceSha256s: readonly string[];
    labelAuthorities: readonly { text: string; surface: string }[];
  };
}

function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().filter((key) => record[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  throw new Error('DIRECTOR_PAID_VIDEO_FINGERPRINT_UNSUPPORTED_VALUE');
}

export function fingerprintDirectorPaidVideoGeneration(
  input: DirectorPaidVideoGenerationFingerprintInput,
): string {
  const normalized = {
    capability: DIRECTOR_PAID_VIDEO_GENERATION_CAPABILITY,
    jobId: input.jobId,
    userId: input.userId,
    projectId: input.projectId,
    providerId: input.providerId,
    prompt: input.prompt.trim(),
    intent: {
      mode: input.intent.mode,
      aspectRatio: input.intent.aspectRatio,
      targetDurationSeconds: input.intent.targetDurationSeconds ?? null,
    },
    character: input.character ? {
      ...input.character,
      referenceSha256s: [...input.character.referenceSha256s].sort(),
    } : null,
    product: input.product ? {
      ...input.product,
      referenceSha256s: [...input.product.referenceSha256s].sort(),
      labelAuthorities: [...input.product.labelAuthorities]
        .map((authority) => ({ text: authority.text.trim(), surface: authority.surface.trim() }))
        .sort((a,b) => a.surface.localeCompare(b.surface) || a.text.localeCompare(b.text)),
    } : null,
  };
  return `sha256:${createHash('sha256').update(canonical(normalized),'utf8').digest('hex')}`;
}
