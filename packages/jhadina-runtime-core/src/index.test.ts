import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertExecutionRequest,
  deriveExecutionId,
  InMemoryExtensionPatchRegistry,
  RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION,
  type ExecutionRequest,
} from './index.js';

const base: ExecutionRequest = {
  executionId: 'exec-1',
  actorId: 'actor-1',
  artifact: {
    artifactId: 'artifact-1',
    digestSha256: 'a'.repeat(64),
    mediaType: 'application/octet-stream',
    trust: 'trusted',
  },
  manifest: {
    manifestId: 'manifest-1',
    artifactDigestSha256: 'a'.repeat(64),
    entrypoint: 'main',
    requestedCapabilities: ['runtime.read'],
    resourceLimits: { maxWallTimeMs: 1000, maxMemoryMb: 64, maxOutputBytes: 4096 },
  },
  capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.read' }],
  requestedAt: '2026-09-01T12:00:00.000Z',
};

test('valid request passes the runtime boundary', () => assert.doesNotThrow(() => assertExecutionRequest(base)));

test('untrusted artifacts are rejected regardless of claimed capability', () => {
  assert.equal(RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION, true);
  assert.throws(() => assertExecutionRequest({ ...base, artifact: { ...base.artifact, trust: 'untrusted' } }), /Untrusted program artifacts/);
});

test('artifact substitution is rejected', () => {
  assert.throws(() => assertExecutionRequest({ ...base, artifact: { ...base.artifact, digestSha256: 'b'.repeat(64) } }), /digest mismatch/);
});

test('actor binding is mandatory', () => {
  assert.throws(() => assertExecutionRequest({ ...base, actorId: '' }), /actor binding/);
});

test('capability grants must exactly bind declared capabilities', () => {
  assert.throws(() => assertExecutionRequest({ ...base, capabilityGrants: [] }), /explicitly bind/);
  assert.throws(() => assertExecutionRequest({ ...base, capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.write' }] }), /not bound/);
});

test('resource limits are mandatory and positive', () => {
  assert.throws(() => assertExecutionRequest({
    ...base,
    manifest: { ...base.manifest, resourceLimits: { maxWallTimeMs: 0, maxMemoryMb: 64, maxOutputBytes: 4096 } },
  }), /resource limit/);
});

test('execution identity is deterministic and actor-bound', () => {
  const input = { actorId: base.actorId, artifactDigestSha256: base.artifact.digestSha256, manifestId: base.manifest.manifestId, requestedAt: base.requestedAt };
  assert.equal(deriveExecutionId(input), deriveExecutionId(input));
  assert.notEqual(deriveExecutionId(input), deriveExecutionId({ ...input, actorId: 'actor-2' }));
});

test('patch registrations are unique metadata and cannot carry executable code', () => {
  const registry = new InMemoryExtensionPatchRegistry();
  registry.register({ patchId: 'patch-1', extensionId: 'ext-1', targetFingerprint: 'target-1', artifactDigestSha256: 'a'.repeat(64), requestedCapabilities: [] });
  assert.equal(registry.list().length, 1);
  assert.throws(() => registry.register({ patchId: 'patch-1', extensionId: 'ext-2', targetFingerprint: 'target-2', artifactDigestSha256: 'b'.repeat(64), requestedCapabilities: [] }), /Duplicate extension patch/);
});
