import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryArtifactAdmissionLedger,
  InMemoryDeploymentSessionLedger,
  InMemoryRevocationDistributionSource,
  RuntimeLeaseGuard,
  createArtifactRevocation,
  createRevocationDistributionSnapshot,
  startDeploymentSession,
  type ArtifactAdmissionReceipt,
  type ArtifactDeploymentReceipt,
  type RuntimeArtifactAttestation,
} from '@jhadina/reference-provenance';
import { createDirectorGenerationRuntimeConfig } from './director-generation-provider-factory';

describe('director generation provider factory', () => {
  const model = {
    id: 'flux-test',
    providerId: 'comfyui-local',
    name: 'Test model',
    version: '1.0.0',
    modalities: ['image'] as const,
    capabilities: ['text-to-image'] as const,
  };
  const runtimeDescriptor = {
    runtimeName: 'comfyui-host',
    runtimeVersion: '1.0.0',
    platform: 'linux',
    architecture: 'x64',
  };
  const authority = {
    runtimeAuthority: 'NONE' as const,
    policyAuthority: 'NONE' as const,
    executionAuthority: 'NONE' as const,
    factualAuthority: 'NONE' as const,
  };

  async function deploymentConfig() {
    const ledger = new InMemoryArtifactAdmissionLedger();
    const admission: ArtifactAdmissionReceipt = {
      schemaVersion: 'REF-PROV-05',
      admissionId: 'admission:director:1',
      pinId: 'artifact:comfyui:model-bundle',
      referenceId: 'provider:comfyui',
      artifactId: 'comfyui:runtime-model-bundle',
      artifactDigest:
        'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      pinHash: 'pin',
      sourceVerificationId: 'source',
      sourceVerificationHash: 'source-hash',
      compatibilityManifestId: 'manifest',
      compatibilityManifestHash: 'manifest-hash',
      runtime: runtimeDescriptor,
      activeProviderContractIds: ['contract:comfyui:v1'],
      providerContractDigests: {
        'contract:comfyui:v1': 'contract-digest',
      },
      licenseBasis: 'PERMISSIVE_VERIFIED',
      registryHash: 'registry',
      admittedAt: '2026-09-20T05:00:00Z',
      receiptHash: 'receipt-hash',
      authority,
    };
    const attestation: RuntimeArtifactAttestation = {
      schemaVersion: 'REF-PROV-05',
      attestationId: 'attestation:director:1',
      admissionId: admission.admissionId,
      admissionReceiptHash: admission.receiptHash,
      pinId: admission.pinId,
      artifactId: admission.artifactId,
      artifactDigest: admission.artifactDigest,
      runtimeInstanceId: 'runtime:director:1',
      runtime: runtimeDescriptor,
      loadedAt: '2026-09-20T05:01:00Z',
      attestationHash: 'attestation-hash',
      authority,
    };
    await ledger.appendAdmission(admission);
    await ledger.appendAttestation(attestation);

    const deployment: ArtifactDeploymentReceipt = {
      schemaVersion: 'REF-PROV-06',
      deploymentId: 'deployment:director:1',
      subsystem: 'director',
      runtimeInstanceId: attestation.runtimeInstanceId,
      artifactId: admission.artifactId,
      pinId: admission.pinId,
      admissionId: admission.admissionId,
      admissionReceiptHash: admission.receiptHash,
      attestationId: attestation.attestationId,
      attestationHash: attestation.attestationHash,
      artifactDigest: admission.artifactDigest,
      verifiedAt: '2026-09-20T05:02:00Z',
    };
    const sessionLedger = new InMemoryDeploymentSessionLedger();
    const session = await startDeploymentSession(sessionLedger, deployment, {
      sessionId: 'session:director:1',
      startedAt: '2026-09-20T05:02:00Z',
      heartbeatTtlMs: 600_000,
    });
    const revocationSource = new InMemoryRevocationDistributionSource(
      createRevocationDistributionSnapshot({
        epoch: 1,
        generatedAt: '2026-09-20T05:02:00Z',
        expiresAt: '2026-09-20T05:12:00Z',
        revocations: [],
      }),
    );
    const runtimeLeaseGuard = new RuntimeLeaseGuard({
      sessionLedger,
      sessionId: session.sessionId,
      revocationSource,
      maxStaleMs: 600_000,
    });
    return {
      artifactDeployment: {
        ledger,
        requirement: {
          deploymentId: deployment.deploymentId,
          subsystem: deployment.subsystem,
          runtimeInstanceId: deployment.runtimeInstanceId,
          runtime: runtimeDescriptor,
          artifactId: deployment.artifactId,
          pinId: deployment.pinId,
          admissionId: deployment.admissionId,
          attestationId: deployment.attestationId,
        },
        verifiedAt: deployment.verifiedAt,
        runtimeLeaseGuard,
      },
      revocationSource,
    };
  }

  it('constructs only after durable ComfyUI artifact proof verifies', async () => {
    const { artifactDeployment } = await deploymentConfig();
    const runtime = await createDirectorGenerationRuntimeConfig({
      artifactDeployment,
      comfyUi: {
        id: 'comfyui-local',
        name: 'ComfyUI local',
        baseUrl: 'http://comfyui:8188',
        models: [model],
      },
    });

    expect(runtime.providers.size).toBe(1);
    expect(runtime.artifactDeployment.artifactId).toBe(
      'comfyui:runtime-model-bundle',
    );
    expect(runtime.registry.getModel('flux-test')?.providerId).toBe(
      'comfyui-local',
    );
  });

  it('checks distributed revocation before every provider invocation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T05:03:00Z'));
    try {
      const { artifactDeployment, revocationSource } =
        await deploymentConfig();
      const runtime = await createDirectorGenerationRuntimeConfig({
        artifactDeployment,
        comfyUi: {
          id: 'comfyui-local',
          baseUrl: 'http://comfyui:8188',
          models: [model],
        },
      });
      revocationSource.setSnapshot(
        createRevocationDistributionSnapshot({
          epoch: 2,
          generatedAt: '2026-09-20T05:02:30Z',
          expiresAt: '2026-09-20T05:12:00Z',
          revocations: [
            createArtifactRevocation({
              revocationId: 'revoke:director:1',
              targetType: 'ARTIFACT_PIN',
              targetId: 'artifact:comfyui:model-bundle',
              reason: 'withdrawn',
              revokedAt: '2026-09-20T05:02:30Z',
            }),
          ],
        }),
      );
      await expect(
        runtime.providers.get('comfyui-local')!.status('job-1'),
      ).rejects.toThrow('REF_PROV_08_RUNTIME_LEASE_REVOKED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed when deployment proof is missing', async () => {
    await expect(
      createDirectorGenerationRuntimeConfig({
        comfyUi: {
          id: 'comfyui-local',
          baseUrl: 'http://comfyui:8188',
          models: [model],
        },
      }),
    ).rejects.toThrow('DIRECTOR_ARTIFACT_DEPLOYMENT_PROOF_REQUIRED');
  });

  it('rejects models bound to a different provider after proof', async () => {
    const { artifactDeployment } = await deploymentConfig();
    await expect(
      createDirectorGenerationRuntimeConfig({
        artifactDeployment,
        comfyUi: {
          id: 'comfyui-local',
          baseUrl: 'http://comfyui:8188',
          models: [{ ...model, providerId: 'other-provider' }],
        },
      }),
    ).rejects.toThrow('DIRECTOR_MODEL_PROVIDER_MISMATCH:flux-test');
  });

  it('does not construct a provider from catalog metadata', async () => {
    vi.stubEnv('DIRECTOR_COMFYUI_URL', '');
    vi.stubEnv('DIRECTOR_COMFYUI_MODELS_JSON', '');
    const { artifactDeployment } = await deploymentConfig();
    await expect(
      createDirectorGenerationRuntimeConfig({
        artifactDeployment,
      }),
    ).rejects.toThrow('DIRECTOR_GENERATION_PROVIDER_NOT_CONFIGURED');
    vi.unstubAllEnvs();
  });
});
