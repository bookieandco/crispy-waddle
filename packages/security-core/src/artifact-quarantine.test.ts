import { describe, expect, it } from 'vitest';
import { DEFAULT_ARTIFACT_POLICY, hashArtifact, inspectArtifact } from './artifact-quarantine.js';

const now = 1_000_000;
const bytes = new TextEncoder().encode('safe-artifact');
const base = {
  artifactId: 'artifact-1', workerId: 'worker-1', mediaType: 'text/plain',
  byteLength: bytes.byteLength, sha256: hashArtifact(bytes), outputPrefix: 'jobs/job-1/',
  createdAt: now - 1_000, expiresAt: now + 60_000,
};

describe('artifact quarantine', () => {
  it('accepts an intact policy-compliant artifact', () => {
    expect(inspectArtifact(base, bytes, DEFAULT_ARTIFACT_POLICY, now).verdict).toBe('accept');
  });
  it('quarantines tampered bytes', () => {
    const changed = new TextEncoder().encode('tampered-artifact');
    expect(inspectArtifact(base, changed, DEFAULT_ARTIFACT_POLICY, now).reason).toBe('length_mismatch');
  });
  it('quarantines hash mismatch', () => {
    expect(inspectArtifact({ ...base, sha256: '0'.repeat(64) }, bytes, DEFAULT_ARTIFACT_POLICY, now).reason).toBe('hash_mismatch');
  });
  it('quarantines unsupported media', () => {
    expect(inspectArtifact({ ...base, mediaType: 'application/x-executable' }, bytes, DEFAULT_ARTIFACT_POLICY, now).reason).toBe('media_type_denied');
  });
  it('quarantines unsafe storage paths', () => {
    expect(inspectArtifact({ ...base, outputPrefix: '../trusted/' }, bytes, DEFAULT_ARTIFACT_POLICY, now).reason).toBe('unsafe_storage_prefix');
  });
});
