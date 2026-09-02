import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertExecutionRequest,
  deriveExecutionId,
  InMemoryExtensionPatchRegistry,
  RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION,
  type ExecutionRequest,
} from './index.js';

const input = { actorId: 'actor-1', artifactDigestSha256: 'a'.repeat(64), manifestId: 'manifest-1', requestedAt: '2026-09-01T12:00:00.000Z' };
const base: ExecutionRequest = {
  executionId: deriveExecutionId(input), actorId: input.actorId,
  artifact: { artifactId: 'artifact-1', digestSha256: input.artifactDigestSha256, mediaType: 'application/octet-stream', trust: 'trusted' },
  manifest: { manifestId: input.manifestId, artifactDigestSha256: input.artifactDigestSha256, entrypoint: 'main', requestedCapabilities: ['runtime.read'], resourceLimits: { maxWallTimeMs: 1000, maxMemoryMb: 64, maxOutputBytes: 4096 } },
  capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.read' }], requestedAt: input.requestedAt,
};

test('valid request passes');
test('valid request passes', () => assert.doesNotThrow(() => assertExecutionRequest(base)));
test('untrusted artifacts are rejected', () => { assert.equal(RUNTIME_CORE_NO_ARBITRARY_UPLOAD_EXECUTION, true); assert.throws(() => assertExecutionRequest({ ...base, artifact: { ...base.artifact, trust: 'untrusted' } }), /Untrusted program artifacts/); });
test('artifact substitution is rejected', () => assert.throws(() => assertExecutionRequest({ ...base, artifact: { ...base.artifact, digestSha256: 'b'.repeat(64) } }), /digest mismatch/));
test('actor binding is mandatory', () => assert.throws(() => assertExecutionRequest({ ...base, actorId: '' }), /actor binding/));
test('caller cannot choose execution identity', () => assert.throws(() => assertExecutionRequest({ ...base, executionId: 'caller-chosen' }), /deterministic request identity/));
test('capability grants exactly match declarations', () => {
  assert.throws(() => assertExecutionRequest({ ...base, capabilityGrants: [] }), /exactly bind/);
  assert.throws(() => assertExecutionRequest({ ...base, capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.write' }] }), /exactly bind/);
  assert.throws(() => assertExecutionRequest({ ...base, manifest: { ...base.manifest, requestedCapabilities: ['runtime.read', 'runtime.write'] }, capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.read' }, { grantId: 'grant-2', capability: 'runtime.read' }] }), /unique/);
});
test('resource limits are positive', () => assert.throws(() => assertExecutionRequest({ ...base, manifest: { ...base.manifest, resourceLimits: { maxWallTimeMs: 0, maxMemoryMb: 64, maxOutputBytes: 4096 } } }), /resource limit/));
test('execution identity is deterministic and actor-bound', () => { assert.equal(deriveExecutionId(input), deriveExecutionId(input)); assert.notEqual(deriveExecutionId(input), deriveExecutionId({ ...input, actorId: 'actor-2' })); });
test('patch registrations are unique metadata', () => { const registry = new InMemoryExtensionPatchRegistry(); registry.register({ patchId: 'patch-1', extensionId: 'ext-1', targetFingerprint: 'target-1', artifactDigestSha256: 'a'.repeat(64), requestedCapabilities: [] }); assert.equal(registry.list().length, 1); assert.throws(() => registry.register({ patchId: 'patch-1', extensionId: 'ext-2', targetFingerprint: 'target-2', artifactDigestSha256: 'b'.repeat(64), requestedCapabilities: [] }), /Duplicate/); });
