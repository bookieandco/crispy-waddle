import { describe, expect, it, vi } from 'vitest';
import {
  InMemoryArtifactAdmissionLedger,
  type ArtifactAdmissionReceipt,
  type RuntimeArtifactAttestation,
} from '@jhadina/reference-provenance';
import type { LoRARecord, ModelRecord } from '@jhadina/director-core';
import { createDirectorGenerationRuntimeConfig } from './director-generation-provider-factory';

describe('director generation provider factory', () => {
  const model: ModelRecord = {
    id: 'flux-test',
    providerId: 'comfyui-local',
    name: 'Test model',
    version: '1.0.0',
    modalities: ['image'],
    capabilities: ['text-to-image'],
    baseModel: 'flux-base',
  };

  const approvedLora: LoRARecord = {
    id: 'character:mary:lora:step-500',
    name: 'Character LoRA — mary',
    version: '500',
    baseModel: 'flux-base',
    triggerWords: ['MARYX7'],
    modalities: ['image'],
    weight: { min: 0, max: 1.5, recommended: 0.9 },
    uri: 'asset://mary-500.safetensors',
    sha256: 'sha-500',
    metadata: {
      status: 'approved-character-lora',
      characterId: 'mary',
      continuityRef: 'character:mary:v1',
      datasetId: 'dataset:mary:v1',
      trainingRequestId: 'train:mary',
      checkpointId: 'step-500',
      approvalReceiptId: 'approval:lora:mary:500',
      approvedAt: '2026-09-24T06:00:00Z',
      approvedBy: 'owner',
      approvalEvidenceIds: ['human:approval', 'qc:identity'],
    },
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
    return {
      ledger,
      requirement: {
        deploymentId: 'deployment:director:1',
        subsystem: 'director',
        runtimeInstanceId: attestation.runtimeInstanceId,
        runtime: runtimeDescriptor,
        artifactId: admission.artifactId,
        pinId: admission.pinId,
        admissionId: admission.admissionId,
        attestationId: attestation.attestationId,
      },
      verifiedAt: '2026-09-20T05:02:00Z',
    };
  }

  it('constructs only after durable ComfyUI artifact proof verifies', async () => {
    const runtime = await createDirectorGenerationRuntimeConfig({
      artifactDeployment: await deploymentConfig(),
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


  it('loads only approval-stamped character LoRAs into the production registry', async () => {
    const runtime = await createDirectorGenerationRuntimeConfig({
      artifactDeployment: await deploymentConfig(),
      comfyUi: {
        id: 'comfyui-local',
        baseUrl: 'http://comfyui:8188',
        models: [model],
      },
      approvedLoras: [approvedLora],
    });

    expect(runtime.registry.getLoRA(approvedLora.id)?.metadata?.approvalReceiptId)
      .toBe('approval:lora:mary:500');
  });

  it('rejects a trained LoRA with no approval receipt', async () => {
    await expect(createDirectorGenerationRuntimeConfig({
      artifactDeployment: await deploymentConfig(),
      comfyUi: {
        id: 'comfyui-local',
        baseUrl: 'http://comfyui:8188',
        models: [model],
      },
      approvedLoras: [{
        ...approvedLora,
        metadata: {
          ...approvedLora.metadata,
          status: 'candidate-character-lora',
          approvalReceiptId: undefined,
        },
      }],
    })).rejects.toThrow('DIRECTOR_APPROVED_LORA_INVALID');
  });

  it('rejects an approved LoRA when its base model is not available', async () => {
    await expect(createDirectorGenerationRuntimeConfig({
      artifactDeployment: await deploymentConfig(),
      comfyUi: {
        id: 'comfyui-local',
        baseUrl: 'http://comfyui:8188',
        models: [model],
      },
      approvedLoras: [{ ...approvedLora, baseModel: 'different-base' }],
    })).rejects.toThrow('DIRECTOR_APPROVED_LORA_BASE_MODEL_UNAVAILABLE');
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
    await expect(
      createDirectorGenerationRuntimeConfig({
        artifactDeployment: await deploymentConfig(),
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
    await expect(
      createDirectorGenerationRuntimeConfig({
        artifactDeployment: await deploymentConfig(),
      }),
    ).rejects.toThrow('DIRECTOR_GENERATION_PROVIDER_NOT_CONFIGURED');
    vi.unstubAllEnvs();
  });
});
