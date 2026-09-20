import assert from 'node:assert/strict';
import test from 'node:test';
import type { ArtifactDeploymentReceipt } from './artifact-deployment.js';
import {
  InMemoryDeploymentSessionLedger,
  assertDeploymentSessionUsable,
  createArtifactRevocation,
  heartbeatDeploymentSession,
  startDeploymentSession,
} from './deployment-session.js';

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

test('session starts, heartbeats and remains usable while proof is live', async () => {
  const ledger = new InMemoryDeploymentSessionLedger();
  const session = await startDeploymentSession(ledger, deployment, {
    sessionId: 'session:1',
    startedAt: '2026-09-20T06:01:00Z',
    heartbeatTtlMs: 60_000,
  });
  assert.equal(session.state, 'ACTIVE');

  const heartbeat = await heartbeatDeploymentSession(
    ledger,
    session.sessionId,
    '2026-09-20T06:01:30Z',
    60_000,
  );
  assert.equal(heartbeat.heartbeatExpiresAt, '2026-09-20T06:02:30.000Z');
  assert.equal(
    (await assertDeploymentSessionUsable(
      ledger,
      session.sessionId,
      '2026-09-20T06:02:00Z',
    )).state,
    'ACTIVE',
  );
});

test('revocation blocks new sessions and invalidates an active session', async () => {
  const ledger = new InMemoryDeploymentSessionLedger();
  const session = await startDeploymentSession(ledger, deployment, {
    sessionId: 'session:2',
    startedAt: '2026-09-20T06:01:00Z',
    heartbeatTtlMs: 120_000,
  });
  const revocation = createArtifactRevocation({
    revocationId: 'revoke:1',
    targetType: 'ARTIFACT_PIN',
    targetId: deployment.pinId,
    reason: 'superseded artifact',
    revokedAt: '2026-09-20T06:01:30Z',
    supersededBy: 'artifact:comfyui:model-bundle:v2',
  });
  await ledger.appendRevocation(revocation);

  await assert.rejects(
    heartbeatDeploymentSession(
      ledger,
      session.sessionId,
      '2026-09-20T06:01:45Z',
      60_000,
    ),
    /SESSION_INVALIDATED_BY_REVOCATION/,
  );
  assert.equal((await ledger.getSession(session.sessionId))?.state, 'INVALIDATED');

  await assert.rejects(
    startDeploymentSession(ledger, deployment, {
      sessionId: 'session:3',
      startedAt: '2026-09-20T06:02:00Z',
      heartbeatTtlMs: 60_000,
    }),
    /DEPLOYMENT_REVOKED/,
  );
});

test('expired heartbeat fails closed', async () => {
  const ledger = new InMemoryDeploymentSessionLedger();
  const session = await startDeploymentSession(ledger, deployment, {
    sessionId: 'session:4',
    startedAt: '2026-09-20T06:01:00Z',
    heartbeatTtlMs: 1_000,
  });
  await assert.rejects(
    assertDeploymentSessionUsable(
      ledger,
      session.sessionId,
      '2026-09-20T06:01:02Z',
    ),
    /HEARTBEAT_EXPIRED/,
  );
});

test('admission and digest revocations are independently enforced', async () => {
  for (const [targetType, targetId] of [
    ['ADMISSION', deployment.admissionId],
    ['ARTIFACT_DIGEST', deployment.artifactDigest],
  ] as const) {
    const ledger = new InMemoryDeploymentSessionLedger();
    await ledger.appendRevocation(createArtifactRevocation({
      revocationId: 'revoke:' + targetType,
      targetType,
      targetId,
      reason: 'withdrawn',
      revokedAt: '2026-09-20T06:00:30Z',
    }));
    await assert.rejects(
      startDeploymentSession(ledger, deployment, {
        sessionId: 'session:' + targetType,
        startedAt: '2026-09-20T06:01:00Z',
        heartbeatTtlMs: 60_000,
      }),
      /DEPLOYMENT_REVOKED/,
    );
  }
});
