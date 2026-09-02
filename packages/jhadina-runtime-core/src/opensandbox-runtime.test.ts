import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOpenSandboxGovernedRuntimeExecutor,
  deriveExecutionId,
  type ExecutionRequest,
  type OpenSandboxClientPort,
  type OpenSandboxHandle,
  type RuntimeAuditEvent,
} from './index.js';

const isolation = {
  provider: 'opensandbox' as const,
  namespaces: 'active' as const,
  cgroups: 'active' as const,
  seccomp: 'active' as const,
  filesystemIsolation: 'active' as const,
  networkIsolation: 'active' as const,
  secureRuntime: 'kata' as const,
};

const request: ExecutionRequest = {
  actorId: 'actor-1',
  artifact: { artifactId: 'artifact-1', digestSha256: 'digest-1', mediaType: 'application/octet-stream', trust: 'trusted' },
  manifest: { manifestId: 'manifest-1', artifactDigestSha256: 'digest-1', entrypoint: 'main', requestedCapabilities: [], resourceLimits: { maxWallTimeMs: 1000, maxMemoryMb: 128, maxOutputBytes: 4096 } },
  requestedAt: '2026-09-01T10:00:00.000Z',
  executionId: deriveExecutionId({ actorId: 'actor-1', artifactDigestSha256: 'digest-1', manifestId: 'manifest-1', requestedAt: '2026-09-01T10:00:00.000Z' }),
  capabilityGrants: [],
};

function handle(status: OpenSandboxHandle['status'] = 'running'): OpenSandboxHandle {
  return { sandboxId: 'sb-1', status, attestation: { sandboxId: 'sb-1', executionId: request.executionId, isolation } };
}

function fakeClient() {
  const calls = { create: [] as unknown[], execute: [] as unknown[], get: [] as string[], delete: [] as string[] };
  const client: OpenSandboxClientPort = {
    createSandbox: async (input) => { calls.create.push(input); return handle(); },
    getSandbox: async (id) => { calls.get.push(id); return handle(); },
    execute: async (id, input) => { calls.execute.push([id, input]); return { executionId: input.executionId, status: 'completed' }; },
    deleteSandbox: async (id) => { calls.delete.push(id); },
  };
  return { client, calls };
}

test('composition root binds resource enforcement and execution to OpenSandbox', async () => {
  const { client, calls } = fakeClient();
  const auditEvents: RuntimeAuditEvent[] = [];
  const executor = createOpenSandboxGovernedRuntimeExecutor({
    policy: { evaluate: async () => 'allow' },
    audit: { append: async (event) => { auditEvents.push(event); } },
    client,
    imageResolver: { resolve: async () => 'registry/jhadina-runtime@sha256:trusted' },
    clock: { now: () => '2026-09-01T10:01:00.000Z' },
  });

  const result = await executor.execute(request);

  assert.equal(result.status, 'completed');
  assert.deepEqual(calls.create[0], { image: 'registry/jhadina-runtime@sha256:trusted', executionId: request.executionId, resourceLimits: request.manifest.resourceLimits });
  assert.deepEqual(calls.get, ['sb-1']);
  assert.deepEqual(calls.execute[0], ['sb-1', request]);
  assert.deepEqual(calls.delete, ['sb-1']);
  assert.deepEqual(auditEvents.map((event) => event.status), ['allowed', 'completed']);
});

test('request data cannot select a weaker sandbox provider', async () => {
  const { client, calls } = fakeClient();
  const executor = createOpenSandboxGovernedRuntimeExecutor({
    policy: { evaluate: async () => 'allow' },
    audit: { append: async () => {} },
    client,
    imageResolver: { resolve: async () => 'trusted-image' },
  });

  const hostileRequest = { ...request, provider: 'hivebox' } as ExecutionRequest & { provider: string };
  const result = await executor.execute(hostileRequest);

  assert.equal(result.status, 'completed');
  assert.equal(calls.create.length, 1);
  assert.equal((calls.create[0] as { image: string }).image, 'trusted-image');
  assert.deepEqual(calls.execute[0], ['sb-1', hostileRequest]);
});
