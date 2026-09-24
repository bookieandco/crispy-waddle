import { describe, expect, it } from 'vitest';
import { GenerationRegistry } from './generation-registry.js';
import {
  approvedCharacterLoraRecord,
  registerApprovedCharacterLora,
  validateApprovedCharacterLoraRecord,
  validateCharacterLoraApproval,
} from './character-lora-approval.js';
import { promoteCharacterLora } from './character-training-pipeline.js';

function promotion() {
  return promoteCharacterLora({
    id: 'train:mary',
    projectId: 'movie-1',
    characterId: 'mary',
    continuityRef: 'character:mary:v1',
    datasetId: 'dataset:mary:v1',
    triggerWord: 'MARYX7',
    baseModel: 'video-base-2.1',
    modalities: ['image', 'video'],
    executionTarget: 'remote-gpu',
    maxTrainingResolution: 512,
    saveEverySteps: 500,
    sampleEverySteps: 500,
    samplePrompts: ['MARYX7 portrait'],
    evidenceIds: ['training:approved'],
  }, {
    id: 'step-500',
    trainingRequestId: 'train:mary',
    step: 500,
    assetUri: 'asset://mary-500.safetensors',
    sha256: 'sha-500',
    sampleIdentityScore: 0.94,
    sampleQualityScore: 0.91,
    overfitScore: 0.08,
    evidenceIds: ['sample:500'],
  });
}

function approval() {
  return {
    approvalReceiptId: 'approval:lora:mary:500',
    candidateLoraId: 'character:mary:lora:step-500',
    checkpointId: 'step-500',
    datasetId: 'dataset:mary:v1',
    continuityRef: 'character:mary:v1',
    approvedAt: '2026-09-24T06:00:00Z',
    approvedBy: 'owner',
    identityScore: 0.94,
    qualityScore: 0.91,
    overfitScore: 0.08,
    evidenceIds: ['human:approval', 'qc:identity', 'qc:quality', 'qc:overfit'],
    authority: 'DIRECTOR_CHARACTER_LORA_APPROVED' as const,
  };
}

const policy = {
  minimumIdentityScore: 0.9,
  minimumQualityScore: 0.85,
  maximumOverfitScore: 0.2,
};

describe('character LoRA approval', () => {
  it('creates an approved registry record only from matching promotion evidence', () => {
    const record = approvedCharacterLoraRecord(promotion(), approval(), policy);
    expect(validateApprovedCharacterLoraRecord(record)).toEqual([]);
    expect(record.metadata).toMatchObject({
      status: 'approved-character-lora',
      approvalReceiptId: 'approval:lora:mary:500',
      datasetId: 'dataset:mary:v1',
      checkpointId: 'step-500',
    });
  });

  it('rejects approval receipts bound to a different candidate or checkpoint', () => {
    const invalid = {
      ...approval(),
      candidateLoraId: 'character:other',
      checkpointId: 'step-1000',
    };
    expect(validateCharacterLoraApproval(promotion(), invalid, policy)).toEqual(expect.arrayContaining([
      'DIRECTOR_CHARACTER_LORA_APPROVAL_CANDIDATE_MISMATCH',
      'DIRECTOR_CHARACTER_LORA_APPROVAL_CHECKPOINT_MISMATCH',
    ]));
  });

  it('rejects approval metrics that do not match checkpoint evidence', () => {
    const invalid = { ...approval(), identityScore: 0.99 };
    expect(validateCharacterLoraApproval(promotion(), invalid, policy)).toContain(
      'DIRECTOR_CHARACTER_LORA_APPROVAL_IDENTITY_EVIDENCE_MISMATCH',
    );
  });

  it('registers an approved LoRA idempotently but fails on a conflicting artifact', () => {
    const registry = new GenerationRegistry();
    const first = registerApprovedCharacterLora(registry, promotion(), approval(), policy);
    const second = registerApprovedCharacterLora(registry, promotion(), approval(), policy);
    expect(second.id).toBe(first.id);

    const changed = promotion();
    changed.lora.sha256 = 'different-sha';
    expect(() => registerApprovedCharacterLora(registry, changed, approval(), policy))
      .toThrow('DIRECTOR_CHARACTER_LORA_REGISTRY_CONFLICT');
  });

  it('does not admit a bare trained LoRA record with no approval metadata', () => {
    const bare = promotion().lora;
    expect(validateApprovedCharacterLoraRecord(bare)).toEqual(expect.arrayContaining([
      'DIRECTOR_CHARACTER_LORA_RECORD_NOT_APPROVED',
      'DIRECTOR_CHARACTER_LORA_RECORD_APPROVAL_EVIDENCE_REQUIRED',
    ]));
  });
});
