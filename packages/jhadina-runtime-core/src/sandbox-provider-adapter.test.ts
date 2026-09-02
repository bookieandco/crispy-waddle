import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SandboxProviderResourceEnforcer, SandboxProviderRuntimeAdapter, deriveExecutionId, type ExecutionRequest, type SandboxLease, type SandboxProviderPort } from './index.js';

const digest = 'b'.repeat(64);
const request: ExecutionRequest = {
  executionId: deriveExecutionId({ actorId: 'actor-1', artifactDigestSha256: digest, manifestId: 'manifest-1', requestedAt: '2026-09-01T12:00:00.000Z' }),
  actorId: 'actor-1',
  artifact: { artifactId: 'artifact-1', digestSha256: digest, mediaType: 'application/octet-stream', trust: 'trusted' },
  manifest: { manifestId: 'manifest-1', artifactDigestSha256: digest, entrypoint: 'main', requestedCapabilities: ['runtime.read'], resourceLimits: { maxWallTimeMs: 1000, maxMemoryMb: 64, maxOutputBytes: 4096 } },
  capabilityGrants: [{ grantId: 'grant-1', capability: 'runtime.read' }],
  requestedAt: '2026-09-01T12:00:00.000Z',
};

function lease(isolation: SandboxLease['isolation']): SandboxLease {
  return {
    executionId: request.executionId,
    limits: request.manifest.resourceLimits,
    enforcement: {
      executionId: request.executionId,
      limitsDigestSha256: 'x',
      dimensions: { wallTime: 'enforced', memory: 'enforced', output: 'enforced', cpu: 'enforced' },
    },
    isolation,
    release: async () => undefined,
  };
}

const activeIsolation = { provider: 'hivebox' as const, namespaces: 'active' as const, cgroups: 'active' as const, seccomp: 'active' as const, filesystemIsolation: 'active' as const, networkIsolation: 'active' as const, secureRuntime: 'none' as const };

test('resource enforcer refuses a sandbox with degraded isolation', async () => {
  const sandbox = lease({ ...activeIsolation, seccomp: 'degraded' });
  let released = false;
  sandbox.release = async () => { released = true; };
  const provider: SandboxProviderPort = { kind: 'hivebox', async provision() { return sandbox; }, async execute() { throw new Error('must not execute'); } };
  await assert.rejects(() => new SandboxProviderResourceEnforcer(provider).acquire(request), /seccomp/);
  assert.equal(released, true);
});

test('runtime adapter rejects a forged non-sandbox lease', async () => {
  const provider: SandboxProviderPort = { kind: 'hivebox', async provision() { return lease(activeIsolation); }, async execute() { throw new Error('must not execute'); } };
  const adapter = new SandboxProviderRuntimeAdapter(provider);
  const forged = { executionId: request.executionId, limits: request.manifest.resourceLimits, enforcement: lease(activeIsolation).enforcement, release: async () => undefined };
  await assert.rejects(() => adapter.execute(request, forged), /isolation evidence/);
});

test('runtime adapter reaches provider only with active isolation evidence', async () => {
  let calls = 0;
  const provider: SandboxProviderPort = { kind: 'hivebox', async provision() { return lease(activeIsolation); }, async execute(req) { calls++; return { executionId: req.executionId, status: 'completed' as const }; } };
  const sandbox = await new SandboxProviderResourceEnforcer(provider).acquire(request);
  const result = await new SandboxProviderRuntimeAdapter(provider).execute(request, sandbox);
  assert.equal(result.status, 'completed');
  assert.equal(calls, 1);
});
