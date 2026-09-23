import type { GenerationReferenceManifest, OrderedGenerationReference } from './generation-reference-manifest.js';
import type { PerformanceDirectionPlan } from './performance-direction.js';
import type { RealismDirectionPlan } from './realism-direction.js';

export type UgcPlatform = 'tiktok' | 'instagram-reels' | 'youtube-shorts' | 'facebook-reels' | 'other';
export type UgcCreatorNature = 'synthetic' | 'licensed-human' | 'brand-employee';
export type UgcStage =
  | 'product-reference'
  | 'creator'
  | 'location'
  | 'concept'
  | 'script'
  | 'generation-brief'
  | 'generation'
  | 'review'
  | 'complete';

export interface UgcProductBrief {
  brandName: string;
  productName: string;
  productBibleId: string;
  targetAudience: string;
  valuePropositionRefs: readonly string[];
  prohibitedClaimRefs: readonly string[];
  requiredClaimEvidenceIds: readonly string[];
  referenceAssetIds: readonly string[];
}

export interface UgcCreatorCandidate {
  id: string;
  creatorNature: UgcCreatorNature;
  characterRef: string;
  audienceFitHypothesis: string;
  appearanceDirection: readonly string[];
  wardrobeDirection: readonly string[];
  voiceDirection?: string;
  referenceAssetIds: readonly string[];
  rightsEvidenceIds: readonly string[];
}

export interface UgcLocationCandidate {
  id: string;
  description: string;
  realismPurpose: string;
  referenceAssetIds: readonly string[];
  rightsEvidenceIds: readonly string[];
}

export interface UgcConceptOption {
  id: string;
  title: string;
  premise: string;
  format: 'review' | 'routine' | 'demonstration' | 'unboxing' | 'story' | 'comparison' | 'custom';
  productUse: string;
  claimRefs: readonly string[];
}

export interface UgcScript {
  id: string;
  durationSeconds: number;
  spokenText: string;
  pronunciationNotes: Readonly<Record<string, string>>;
  performancePlan: PerformanceDirectionPlan;
  realismPlan?: RealismDirectionPlan;
  claimRefs: readonly string[];
  disclosureLine?: string;
}

export interface UgcApprovalReceipt {
  id: string;
  stage: Exclude<UgcStage, 'generation' | 'review' | 'complete'>;
  selectedRef: string;
  approvedAt: string;
  approvedBy: string;
}

export interface UgcProductionPlan {
  id: string;
  projectId: string;
  platform: UgcPlatform;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  targetRuntimeSeconds: number;
  product: UgcProductBrief;
  creatorCandidates: readonly UgcCreatorCandidate[];
  locationCandidates: readonly UgcLocationCandidate[];
  conceptOptions: readonly UgcConceptOption[];
  scriptCandidates: readonly UgcScript[];
  approvals: readonly UgcApprovalReceipt[];
  currentStage: UgcStage;
  syntheticDisclosurePolicy: 'required' | 'project-policy';
  authority: 'DIRECTOR_UGC_PLAN';
}

export interface UgcGenerationReadiness {
  ready: boolean;
  reasons: readonly string[];
  selected: {
    creator?: UgcCreatorCandidate;
    location?: UgcLocationCandidate;
    concept?: UgcConceptOption;
    script?: UgcScript;
  };
}

const REQUIRED_APPROVAL_STAGES: readonly UgcApprovalReceipt['stage'][] = Object.freeze([
  'product-reference',
  'creator',
  'location',
  'concept',
  'script',
  'generation-brief',
]);

export function evaluateUgcGenerationReadiness(plan: UgcProductionPlan): UgcGenerationReadiness {
  const reasons: string[] = [];
  if (!plan.id.trim() || !plan.projectId.trim()) reasons.push('DIRECTOR_UGC_IDENTITY_REQUIRED');
  if (!Number.isFinite(plan.targetRuntimeSeconds) || plan.targetRuntimeSeconds <= 0 || plan.targetRuntimeSeconds > 180) {
    reasons.push('DIRECTOR_UGC_RUNTIME_INVALID');
  }
  if (!plan.product.productBibleId.trim()) reasons.push('DIRECTOR_UGC_PRODUCT_BIBLE_REQUIRED');
  if (!plan.product.requiredClaimEvidenceIds.length) reasons.push('DIRECTOR_UGC_CLAIM_EVIDENCE_REQUIRED');
  if (!plan.product.referenceAssetIds.length) reasons.push('DIRECTOR_UGC_PRODUCT_REFERENCE_REQUIRED');

  const receipts = new Map(plan.approvals.map((approval) => [approval.stage, approval]));
  for (const stage of REQUIRED_APPROVAL_STAGES) {
    if (!receipts.has(stage)) reasons.push(`DIRECTOR_UGC_APPROVAL_REQUIRED:${stage}`);
  }

  const creator = resolveSelected(plan.creatorCandidates, receipts.get('creator')?.selectedRef);
  const location = resolveSelected(plan.locationCandidates, receipts.get('location')?.selectedRef);
  const concept = resolveSelected(plan.conceptOptions, receipts.get('concept')?.selectedRef);
  const script = resolveSelected(plan.scriptCandidates, receipts.get('script')?.selectedRef);

  if (!creator) reasons.push('DIRECTOR_UGC_CREATOR_SELECTION_INVALID');
  if (!location) reasons.push('DIRECTOR_UGC_LOCATION_SELECTION_INVALID');
  if (!concept) reasons.push('DIRECTOR_UGC_CONCEPT_SELECTION_INVALID');
  if (!script) reasons.push('DIRECTOR_UGC_SCRIPT_SELECTION_INVALID');

  if (creator && !creator.rightsEvidenceIds.length) reasons.push('DIRECTOR_UGC_CREATOR_RIGHTS_REQUIRED');
  if (creator && !creator.referenceAssetIds.length) reasons.push('DIRECTOR_UGC_CREATOR_REFERENCE_REQUIRED');
  if (location && !location.rightsEvidenceIds.length) reasons.push('DIRECTOR_UGC_LOCATION_RIGHTS_REQUIRED');

  if (script) {
    if (!script.spokenText.trim()) reasons.push('DIRECTOR_UGC_SCRIPT_TEXT_REQUIRED');
    if (Math.abs(script.durationSeconds - plan.targetRuntimeSeconds) > Math.max(2, plan.targetRuntimeSeconds * 0.2)) {
      reasons.push('DIRECTOR_UGC_SCRIPT_RUNTIME_DRIFT');
    }
    for (const claimRef of script.claimRefs) {
      if (!plan.product.valuePropositionRefs.includes(claimRef)) {
        reasons.push(`DIRECTOR_UGC_UNAPPROVED_CLAIM:${claimRef}`);
      }
      if (plan.product.prohibitedClaimRefs.includes(claimRef)) {
        reasons.push(`DIRECTOR_UGC_PROHIBITED_CLAIM:${claimRef}`);
      }
    }
  }

  if (concept) {
    for (const claimRef of concept.claimRefs) {
      if (!plan.product.valuePropositionRefs.includes(claimRef)) {
        reasons.push(`DIRECTOR_UGC_UNAPPROVED_CLAIM:${claimRef}`);
      }
    }
  }

  if (creator?.creatorNature === 'synthetic' && plan.syntheticDisclosurePolicy === 'required' && !script?.disclosureLine?.trim()) {
    reasons.push('DIRECTOR_UGC_SYNTHETIC_DISCLOSURE_REQUIRED');
  }

  return Object.freeze({
    ready: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    selected: Object.freeze({ creator, location, concept, script }),
  });
}

export function assertUgcGenerationReady(plan: UgcProductionPlan): UgcGenerationReadiness {
  const decision = evaluateUgcGenerationReadiness(plan);
  if (!decision.ready) throw new Error(decision.reasons.join(';'));
  return decision;
}

export function nextUgcStage(plan: UgcProductionPlan): UgcStage {
  const approvals = new Set(plan.approvals.map((approval) => approval.stage));
  for (const stage of REQUIRED_APPROVAL_STAGES) {
    if (!approvals.has(stage)) return stage;
  }
  return plan.currentStage === 'generation' || plan.currentStage === 'review' || plan.currentStage === 'complete'
    ? plan.currentStage
    : 'generation';
}

export function compileUgcGenerationBrief(plan: UgcProductionPlan): {
  prompt: string;
  referenceAssetIds: readonly string[];
  productBibleId: string;
  creatorRef: string;
  conceptId: string;
  scriptId: string;
  referenceManifest: GenerationReferenceManifest;
} {
  const ready = assertUgcGenerationReady(plan);
  const { creator, location, concept, script } = ready.selected;
  if (!creator || !location || !concept || !script) throw new Error('DIRECTOR_UGC_SELECTION_REQUIRED');

  const prompt = [
    `Format: creator-style UGC for ${plan.platform}, ${plan.aspectRatio}, target ${plan.targetRuntimeSeconds}s.`,
    `Product: ${plan.product.brandName} ${plan.product.productName}. Use Product Bible ${plan.product.productBibleId} as identity/label authority.`,
    `Creator: ${creator.characterRef}. Audience-fit hypothesis: ${creator.audienceFitHypothesis}.`,
    `Location: ${location.description}. Realism purpose: ${location.realismPurpose}.`,
    `Concept: ${concept.premise}. Product use: ${concept.productUse}.`,
    `Script: ${script.spokenText}`,
    script.disclosureLine ? `Disclosure: ${script.disclosureLine}` : undefined,
    `Do not introduce claims outside approved refs: ${plan.product.valuePropositionRefs.join(', ')}.`,
    `Prohibited claims: ${plan.product.prohibitedClaimRefs.join(', ') || 'none listed'}.`,
  ].filter(Boolean).join('\n');

  const references: OrderedGenerationReference[] = [];
  let slot = 1;
  for (const assetId of plan.product.referenceAssetIds) {
    references.push({
      slot: slot++,
      assetId,
      media: 'image',
      role: 'product-identity',
      semanticLabel: `approved product identity for ${plan.product.brandName} ${plan.product.productName}`,
      promptToken: `PRODUCT_${slot - 1}`,
      required: true,
      evidenceIds: plan.product.requiredClaimEvidenceIds,
    });
  }
  for (const assetId of creator.referenceAssetIds) {
    references.push({
      slot: slot++,
      assetId,
      media: 'image',
      role: 'character-identity',
      semanticLabel: `approved creator identity ${creator.characterRef}`,
      promptToken: `CREATOR_${slot - 1}`,
      required: true,
      evidenceIds: creator.rightsEvidenceIds,
    });
  }
  for (const assetId of location.referenceAssetIds) {
    references.push({
      slot: slot++,
      assetId,
      media: 'image',
      role: 'location',
      semanticLabel: `approved UGC location: ${location.description}`,
      promptToken: `LOCATION_${slot - 1}`,
      required: true,
      evidenceIds: location.rightsEvidenceIds,
    });
  }

  const referenceManifest: GenerationReferenceManifest = Object.freeze({
    id: `${plan.id}:references`,
    projectId: plan.projectId,
    shotId: plan.id,
    references: Object.freeze(references.map((reference) => Object.freeze({
      ...reference,
      evidenceIds: Object.freeze([...reference.evidenceIds]),
    }))),
    authority: 'DIRECTOR_REFERENCE_MANIFEST',
  });

  return Object.freeze({
    prompt,
    referenceAssetIds: Object.freeze(references.map((reference) => reference.assetId)),
    productBibleId: plan.product.productBibleId,
    creatorRef: creator.characterRef,
    conceptId: concept.id,
    scriptId: script.id,
    referenceManifest,
  });
}

function resolveSelected<T extends { id: string }>(items: readonly T[], selectedRef?: string): T | undefined {
  if (!selectedRef) return undefined;
  return items.find((item) => item.id === selectedRef);
}
