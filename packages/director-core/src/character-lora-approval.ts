import type { GenerationRegistry, LoRARecord } from './generation-registry.js';
import type { CharacterLoraPromotion } from './character-training-pipeline.js';

export interface CharacterLoraApprovalEvidence {
  approvalReceiptId: string;
  candidateLoraId: string;
  checkpointId: string;
  datasetId: string;
  continuityRef: string;
  approvedAt: string;
  approvedBy: string;
  identityScore: number;
  qualityScore: number;
  overfitScore: number;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_CHARACTER_LORA_APPROVED';
}

export interface CharacterLoraApprovalPolicy {
  minimumIdentityScore: number;
  minimumQualityScore: number;
  maximumOverfitScore: number;
}

export function validateCharacterLoraApproval(
  promotion: CharacterLoraPromotion,
  approval: CharacterLoraApprovalEvidence,
  policy: CharacterLoraApprovalPolicy,
): readonly string[] {
  const reasons: string[] = [];
  const metadata = promotion.lora.metadata ?? {};

  if (!approval.approvalReceiptId.trim() || !approval.approvedBy.trim() || !approval.approvedAt.trim()) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_RECEIPT_REQUIRED');
  }
  if (approval.authority !== 'DIRECTOR_CHARACTER_LORA_APPROVED') {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_AUTHORITY_INVALID');
  }
  if (approval.candidateLoraId !== promotion.lora.id) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_CANDIDATE_MISMATCH');
  }
  if (approval.checkpointId !== promotion.checkpoint.id || approval.checkpointId !== metadata.checkpointId) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_CHECKPOINT_MISMATCH');
  }
  if (approval.datasetId !== metadata.datasetId) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_DATASET_MISMATCH');
  }
  if (approval.continuityRef !== metadata.continuityRef) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_CONTINUITY_MISMATCH');
  }
  if (!approval.evidenceIds.length) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_EVIDENCE_REQUIRED');
  }
  if (!scoreAtLeast(approval.identityScore, policy.minimumIdentityScore)) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_IDENTITY_LOW');
  }
  if (!scoreAtLeast(approval.qualityScore, policy.minimumQualityScore)) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_QUALITY_LOW');
  }
  if (!scoreAtMost(approval.overfitScore, policy.maximumOverfitScore)) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_OVERFIT_HIGH');
  }

  if (Math.abs(approval.identityScore - promotion.checkpoint.sampleIdentityScore) > 1e-9) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_IDENTITY_EVIDENCE_MISMATCH');
  }
  if (Math.abs(approval.qualityScore - promotion.checkpoint.sampleQualityScore) > 1e-9) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_QUALITY_EVIDENCE_MISMATCH');
  }
  if (Math.abs(approval.overfitScore - promotion.checkpoint.overfitScore) > 1e-9) {
    reasons.push('DIRECTOR_CHARACTER_LORA_APPROVAL_OVERFIT_EVIDENCE_MISMATCH');
  }

  return Object.freeze([...new Set(reasons)]);
}

export function approvedCharacterLoraRecord(
  promotion: CharacterLoraPromotion,
  approval: CharacterLoraApprovalEvidence,
  policy: CharacterLoraApprovalPolicy,
): LoRARecord {
  const reasons = validateCharacterLoraApproval(promotion, approval, policy);
  if (reasons.length) {
    throw new Error(`DIRECTOR_CHARACTER_LORA_APPROVAL_INVALID: ${reasons.join(', ')}`);
  }

  return Object.freeze({
    ...promotion.lora,
    triggerWords: promotion.lora.triggerWords ? [...promotion.lora.triggerWords] : undefined,
    modalities: [...promotion.lora.modalities],
    weight: { ...promotion.lora.weight },
    metadata: {
      ...(promotion.lora.metadata ?? {}),
      status: 'approved-character-lora',
      approvalReceiptId: approval.approvalReceiptId,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      approvalEvidenceIds: [...approval.evidenceIds],
    },
  });
}

export function registerApprovedCharacterLora(
  registry: GenerationRegistry,
  promotion: CharacterLoraPromotion,
  approval: CharacterLoraApprovalEvidence,
  policy: CharacterLoraApprovalPolicy,
): LoRARecord {
  const approved = approvedCharacterLoraRecord(promotion, approval, policy);
  const existing = registry.getLoRA(approved.id);
  if (existing) {
    if (
      existing.sha256 !== approved.sha256 ||
      existing.baseModel !== approved.baseModel ||
      existing.uri !== approved.uri
    ) {
      throw new Error(`DIRECTOR_CHARACTER_LORA_REGISTRY_CONFLICT:${approved.id}`);
    }
    return existing;
  }
  registry.registerLoRA(approved);
  return registry.getLoRA(approved.id)!;
}

export function validateApprovedCharacterLoraRecord(lora: LoRARecord): readonly string[] {
  const reasons: string[] = [];
  const metadata = lora.metadata ?? {};
  if (metadata.status !== 'approved-character-lora') {
    reasons.push('DIRECTOR_CHARACTER_LORA_RECORD_NOT_APPROVED');
  }
  for (const key of ['approvalReceiptId', 'approvedAt', 'approvedBy', 'continuityRef', 'datasetId', 'checkpointId']) {
    if (typeof metadata[key] !== 'string' || !(metadata[key] as string).trim()) {
      reasons.push(`DIRECTOR_CHARACTER_LORA_RECORD_METADATA_REQUIRED:${key}`);
    }
  }
  if (!Array.isArray(metadata.approvalEvidenceIds) || !metadata.approvalEvidenceIds.length) {
    reasons.push('DIRECTOR_CHARACTER_LORA_RECORD_APPROVAL_EVIDENCE_REQUIRED');
  }
  if (!lora.uri?.trim() || !lora.sha256?.trim()) {
    reasons.push('DIRECTOR_CHARACTER_LORA_RECORD_ARTIFACT_REQUIRED');
  }
  if (!lora.triggerWords?.length) {
    reasons.push('DIRECTOR_CHARACTER_LORA_RECORD_TRIGGER_REQUIRED');
  }
  return Object.freeze([...new Set(reasons)]);
}

function scoreAtLeast(value: number, minimum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= 1;
}

function scoreAtMost(value: number, maximum: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= maximum && value <= 1;
}
