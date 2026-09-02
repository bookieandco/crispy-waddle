import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSandboxIsolationEvidence, SANDBOX_PROVIDER_GUIDANCE, type SandboxIsolationEvidence } from './index.js';

const evidence: SandboxIsolationEvidence = {
  provider: 'opensandbox',
  namespaces: true,
  cgroups: true,
  seccomp: true,
  filesystemIsolation: true,
  networkIsolation: true,
  secureRuntime: 'kata',
};

test('accepts complete sandbox isolation evidence', () => {
  assert.doesNotThrow(() => assertSandboxIsolationEvidence(evidence));
});

for (const field of ['namespaces', 'cgroups', 'seccomp', 'filesystemIsolation', 'networkIsolation'] as const) {
  test(`rejects sandbox evidence when ${field} is not enforced`, () => {
    assert.throws(() => assertSandboxIsolationEvidence({ ...evidence, [field]: false }), new RegExp(`${field === 'filesystemIsolation' ? 'filesystem isolation' : field === 'networkIsolation' ? 'network isolation' : field}`));
  });
}

test('provider guidance keeps OpenSandbox and HiveBox as runtime implementations, not policy authorities', () => {
  assert.match(SANDBOX_PROVIDER_GUIDANCE.opensandbox, /Docker\/Kubernetes/);
  assert.match(SANDBOX_PROVIDER_GUIDANCE.hivebox, /cgroups v2/);
});
