import { createHash } from 'node:crypto';

export type ArtifactVerdict = 'quarantine' | 'accept';

export type ArtifactManifest = {
  artifactId: string;
  workerId: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  outputPrefix: string;
  createdAt: number;
  expiresAt: number;
};

export type ArtifactPolicy = {
  maxBytes: number;
  allowedMediaTypes: readonly string[];
  maxAgeMs: number;
};

export type ArtifactCheck = {
  verdict: ArtifactVerdict;
  reason: string;
  sha256: string;
};

export function hashArtifact(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function inspectArtifact(
  manifest: ArtifactManifest,
  bytes: Uint8Array,
  policy: ArtifactPolicy,
  now = Date.now(),
): ArtifactCheck {
  const digest = hashArtifact(bytes);
  if (!manifest.artifactId || !manifest.workerId) return { verdict: 'quarantine', reason: 'missing_identity', sha256: digest };
  if (manifest.byteLength !== bytes.byteLength) return { verdict: 'quarantine', reason: 'length_mismatch', sha256: digest };
  if (manifest.byteLength > policy.maxBytes) return { verdict: 'quarantine', reason: 'size_limit_exceeded', sha256: digest };
  if (!policy.allowedMediaTypes.includes(manifest.mediaType)) return { verdict: 'quarantine', reason: 'media_type_denied', sha256: digest };
  if (manifest.createdAt > now || now - manifest.createdAt > policy.maxAgeMs) return { verdict: 'quarantine', reason: 'artifact_age_invalid', sha256: digest };
  if (manifest.expiresAt <= now) return { verdict: 'quarantine', reason: 'artifact_expired', sha256: digest };
  if (manifest.sha256 !== digest) return { verdict: 'quarantine', reason: 'hash_mismatch', sha256: digest };
  if (manifest.outputPrefix.includes('..') || manifest.outputPrefix.startsWith('/')) return { verdict: 'quarantine', reason: 'unsafe_storage_prefix', sha256: digest };
  return { verdict: 'accept', reason: 'integrity_and_policy_checks_passed', sha256: digest };
}

export const DEFAULT_ARTIFACT_POLICY: ArtifactPolicy = {
  maxBytes: 2 * 1024 * 1024 * 1024,
  allowedMediaTypes: [
    'image/png', 'image/jpeg', 'image/webp', 'audio/wav', 'audio/mpeg',
    'video/mp4', 'application/json', 'text/plain',
  ],
  maxAgeMs: 60 * 60_000,
};
