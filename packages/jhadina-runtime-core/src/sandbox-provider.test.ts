import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxIsolationEvidence, SANDBOX_PROVIDER_GUIDANCE, type SandboxIsolationEvidence } from './index.js';

const evidence: SandboxIsolationEvidence = {
  provider: 'opensandbox',
  namespaces: 'active',
  cgroups: 'active',
  seccomp: 'active',
  filesystemIsolation: 'active',
  networkIsolation: 'active',
  secureRuntime: 'kata',
};

test('accepts complete sandbox isolation evidence', () => {
  assert.doesNotThrow(() => assertSandboxIsolationEvidence(evidence));
});

for (const field of ['namespaces', 'cgroups', 'seccomp', 'filesystemIsolation', 'networkIsolation'] as const) {
  test(`rejects sandbox evidence when ${field} is degraded`, () => {
    assert.throws(() => assertSandboxIsolationEvidence({ ...evidence, [field]: 'degraded' }));
  });
  test(`rejects sandbox evidence when ${field} is disabled`, () => {
    assert.throws(() => assertSandboxIsolationEvidence({ ...evidence, [field]: 'disabled' }));
  });
}

test('provider guidance keeps OpenSandbox and HiveBox as runtime implementations, not policy authorities', () => {
  assert.match(SANDBOX_PROVIDER_GUIDANCE.opensandbox, /Docker\/Kubernetes/);
  assert.match(SANDBOX_PROVIDER_GUIDANCE.hivebox, /cgroups v2/);
});
