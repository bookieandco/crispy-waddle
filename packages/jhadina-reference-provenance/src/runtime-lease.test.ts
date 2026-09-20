import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtifactDeploymentReceipt } from './artifact-deployment.js';
import {
  InMemoryDeploymentSessionLedger,
  createArtifactRevocation,
  startDeploymentSession,
} from './deployment-session.js';
import {
  InMemoryRevocationDistributionSource,
  RuntimeLeaseGuard,
  createRevocationDistributionSnapshot,
} from './runtime-lease.js';

const deployment: ArtifactDeploymentReceipt = {
  schemaVersion: 'REF-PROV-06',
  deploymentId: 'deployment:director:1',
  subsystem: 'director',
  runtimeInstanceId: 'runtime:director:1',
  artifactId: 'comfyui:runtime-model-bundle',
  pinId: 'artifact:comfyui:model-bundle',
  admissionId: 'admission:1',
  admissionReceiptHash: 'receipt',
  attestationId: 'attestation:1',
  attestationHash: 'attestation',
  artifactDigest: 'sha256:' + 'a'.repeat(64),
  verifiedAt: '2026-09-20T06:00:00Z',
};

async function setup(maxStaleMs = 60_000) {
  const ledger = new InMemoryDeploymentSessionLedger();
  const session = await startDeploymentSession(ledger, deployment, {
    sessionId: 'session:1',
    startedAt: '2026-09-20T06:00:00Z',
    heartbeatTtlMs: 300_000,
  });
  const source = new InMemoryRevocationDistributionSource(
    createRevocationDistributionSnapshot({
      epoch: 1,
      generatedAt: '2026-09-20T06:00:00Z',
      expiresAt: '2026-09-20T06:05:00Z',
      revocations: [],
    }),
  );
  return {
    ledger,
    session,
    source,
    guard: new RuntimeLeaseGuard({
      sessionLedger: ledger,
      sessionId: session.sessionId,
      revocationSource: source,
      maxStaleMs,
    }),
  };
}

test('every lease check binds to a live session and distributed snapshot', async () => {
  const { guard } = await setup();
  const proof = await guard.assertUsable('2026-09-20T06:00:30Z');
  assert.equal(proof.session.state, 'ACTIVE');
  assert.equal(proof.revocationEpoch, 1);
  assert.equal(proof.revocationSnapshotHash.length, 64);
});

test('distributed revocation blocks invocation even before local ledger refresh', async () => {
  const { guard, source } = await setup();
  const revocation = createArtifactRevocation({
    revocationId: 'revoke:remote:1',
    targetType: 'ARTIFACT_DIGEST',
    targetId: deployment.artifactDigest,
    reason: 'artifact withdrawn',
    revokedAt: '2026-09-20T06:00:40Z',
  });
  source.setSnapshot(createRevocationDistributionSnapshot({
    epoch: 2,
    generatedAt: '2026-09-20T06:00:45Z',
    expiresAt: '2026-09-20T06:05:00Z',
    revocations: [revocation],
  }));
  await assert.rejects(
    guard.assertUsable('2026-09-20T06:00:50Z'),
    /RUNTIME_LEASE_REVOKED/,
  );
});

test('disconnected worker may use cache only inside bounded stale window', async () => {
  const { guard, source } = await setup(60_000);
  await guard.assertUsable('2026-09-20T06:00:20Z');
  source.setAvailable(false);

  await guard.assertUsable('2026-09-20T06:00:50Z');
  await assert.rejects(
    guard.assertUsable('2026-09-20T06:01:01Z'),
    /REVOCATION_CACHE_STALE/,
  );
});

test('snapshot expiry fails closed even when max stale window is larger', async () => {
  const { ledger, session } = await setup();
  const source = new InMemoryRevocationDistributionSource(
    createRevocationDistributionSnapshot({
      epoch: 5,
      generatedAt: '2026-09-20T06:00:00Z',
      expiresAt: '2026-09-20T06:00:30Z',
      revocations: [],
    }),
  );
  const guard = new RuntimeLeaseGuard({
    sessionLedger: ledger,
    sessionId: session.sessionId,
    revocationSource: source,
    maxStaleMs: 300_000,
  });
  await assert.rejects(
    guard.assertUsable('2026-09-20T06:00:31Z'),
    /REVOCATION_SNAPSHOT_EXPIRED/,
  );
});

test('epoch rollback cannot replace a newer cached revocation view', async () => {
  const { guard, source } = await setup();
  await guard.assertUsable('2026-09-20T06:00:10Z');
  source.setSnapshot(createRevocationDistributionSnapshot({
    epoch: 0,
    generatedAt: '2026-09-20T06:00:20Z',
    expiresAt: '2026-09-20T06:05:00Z',
    revocations: [],
  }));
  await assert.rejects(
    guard.assertUsable('2026-09-20T06:00:25Z'),
    /REVOCATION_EPOCH_ROLLBACK/,
  );
});
