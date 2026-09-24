import type { LoRARecord } from './generation-registry.js';
import type { CharacterReferenceView } from './character-reference-bootstrap.js';

export type CharacterDatasetKind =
  | 'angle'
  | 'expression'
  | 'pose'
  | 'wardrobe'
  | 'environment'
  | 'motion-frame';

export interface CharacterDatasetCandidate {
  id: string;
  characterId: string;
  assetId: string;
  sha256: string;
  kind: CharacterDatasetKind;
  view?: CharacterReferenceView;
  expression?: string;
  poseLabel?: string;
  appearanceVariantId?: string;
  parentAssetIds: readonly string[];
  identityScore: number;
  anatomyScore: number;
  qualityScore: number;
  duplicateGroup?: string;
  evidenceIds: readonly string[];
}

export interface CharacterCaptionRecord {
  datasetItemId: string;
  triggerWord: string;
  caption: string;
  evidenceIds: readonly string[];
}

export interface CharacterUpscaleResult {
  datasetItemId: string;
  sourceAssetId: string;
  upscaledAssetId: string;
  sourceSha256: string;
  upscaledSha256: string;
  scaleFactor: number;
  identitySimilarity: number;
  qualityScore: number;
  fidelityBias: number;
  evidenceIds: readonly string[];
}


export interface CharacterPoseReference {
  id: string;
  assetId: string;
  label: string;
  evidenceIds: readonly string[];
}

export interface CharacterWardrobeReference {
  id: string;
  assetId: string;
  label: string;
  evidenceIds: readonly string[];
}

export interface CharacterDatasetGenerationRequest {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  canonicalAssetId: string;
  triggerWord: string;
  targetViews: readonly CharacterReferenceView[];
  expressions: readonly string[];
  poseReferences?: readonly CharacterPoseReference[];
  wardrobeReferences?: readonly CharacterWardrobeReference[];
  styleIntent?: string;
  includeEnvironmentProbes?: boolean;
  evidenceIds: readonly string[];
}

export interface CharacterDatasetGenerationTask {
  id: string;
  kind: CharacterDatasetKind;
  label: string;
  sourceAssetIds: readonly string[];
  targetView?: CharacterReferenceView;
  expression?: string;
  poseReferenceId?: string;
  wardrobeReferenceId?: string;
  instruction: string;
}

export interface CharacterDatasetGenerationPlan {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  canonicalAssetId: string;
  triggerWord: string;
  tasks: readonly CharacterDatasetGenerationTask[];
  stages: readonly ('generate' | 'curate' | 'caption' | 'upscale' | 'optional-train-lora')[];
  authority: 'DIRECTOR_CHARACTER_DATASET_PLAN';
}

export function planCharacterDatasetGeneration(
  request: CharacterDatasetGenerationRequest,
): CharacterDatasetGenerationPlan {
  const reasons: string[] = [];
  if (
    !request.id.trim() ||
    !request.projectId.trim() ||
    !request.characterId.trim() ||
    !request.continuityRef.trim() ||
    !request.canonicalAssetId.trim()
  ) {
    reasons.push('DIRECTOR_CHARACTER_DATASET_PLAN_IDENTITY_REQUIRED');
  }
  if (!isValidTriggerWord(request.triggerWord)) reasons.push('DIRECTOR_CHARACTER_DATASET_TRIGGER_WORD_INVALID');
  if (!request.evidenceIds.length) reasons.push('DIRECTOR_CHARACTER_DATASET_PLAN_EVIDENCE_REQUIRED');

  const tasks: CharacterDatasetGenerationTask[] = [];
  const pushTask = (task: Omit<CharacterDatasetGenerationTask, 'id'>) => {
    tasks.push(Object.freeze({ id: `${request.id}:task:${tasks.length + 1}`, ...task }));
  };

  for (const view of [...new Set(request.targetViews)]) {
    if (view === 'unknown') continue;
    pushTask({
      kind: 'angle',
      label: `view:${view}`,
      sourceAssetIds: [request.canonicalAssetId],
      targetView: view,
      instruction: [
        `Preserve ${request.characterId} identity from the canonical reference.`,
        `Generate a ${view} character reference on a simple neutral background with neutral lighting.`,
        request.styleIntent?.trim() ? `Preserve style intent: ${request.styleIntent.trim()}.` : undefined,
      ].filter((value): value is string => Boolean(value)).join(' '),
    });
  }

  for (const expression of [...new Set(request.expressions.map((value) => value.trim()).filter(Boolean))]) {
    pushTask({
      kind: 'expression',
      label: `expression:${expression}`,
      sourceAssetIds: [request.canonicalAssetId],
      expression,
      instruction: `Preserve identity and apply only the expression "${expression}" to the canonical face reference.`,
    });
  }

  for (const pose of request.poseReferences ?? []) {
    if (!pose.id.trim() || !pose.assetId.trim() || !pose.label.trim() || !pose.evidenceIds.length) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_POSE_REFERENCE_INVALID:${pose.id || 'unknown'}`);
      continue;
    }
    pushTask({
      kind: 'pose',
      label: `pose:${pose.label}`,
      sourceAssetIds: [request.canonicalAssetId, pose.assetId],
      poseReferenceId: pose.id,
      instruction: `Preserve character identity and transfer only the body pose from pose reference "${pose.label}".`,
    });
  }

  for (const wardrobe of request.wardrobeReferences ?? []) {
    if (!wardrobe.id.trim() || !wardrobe.assetId.trim() || !wardrobe.label.trim() || !wardrobe.evidenceIds.length) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_WARDROBE_REFERENCE_INVALID:${wardrobe.id || 'unknown'}`);
      continue;
    }
    pushTask({
      kind: 'wardrobe',
      label: `wardrobe:${wardrobe.label}`,
      sourceAssetIds: [request.canonicalAssetId, wardrobe.assetId],
      wardrobeReferenceId: wardrobe.id,
      instruction: `Preserve character identity and body proportions; apply only wardrobe reference "${wardrobe.label}".`,
    });
  }

  if (request.includeEnvironmentProbes) {
    pushTask({
      kind: 'environment',
      label: 'environment:walking-natural',
      sourceAssetIds: [request.canonicalAssetId],
      instruction: 'Preserve identity while placing the character in a simple natural walking environment for generalization coverage.',
    });
  }

  if (!tasks.length) reasons.push('DIRECTOR_CHARACTER_DATASET_PLAN_TASKS_REQUIRED');
  if (reasons.length) throw new Error(`DIRECTOR_CHARACTER_DATASET_PLAN_INVALID: ${[...new Set(reasons)].join(', ')}`);

  const stages: CharacterDatasetGenerationPlan['stages'] = Object.freeze([
    'generate',
    'curate',
    'caption',
    'upscale',
    'optional-train-lora',
  ]);

  return Object.freeze({
    id: request.id,
    projectId: request.projectId,
    characterId: request.characterId,
    continuityRef: request.continuityRef,
    canonicalAssetId: request.canonicalAssetId,
    triggerWord: request.triggerWord,
    tasks: Object.freeze(tasks),
    stages,
    authority: 'DIRECTOR_CHARACTER_DATASET_PLAN',
  });
}

export interface CharacterDatasetPolicy {
  minimumItems: number;
  maximumItems: number;
  minimumIdentityScore: number;
  minimumAnatomyScore: number;
  minimumQualityScore: number;
  minimumUpscaleIdentitySimilarity: number;
  minimumUpscaleQualityScore: number;
  requireViews: readonly CharacterReferenceView[];
  requireKinds: readonly CharacterDatasetKind[];
  maximumPerDuplicateGroup: number;
}

export interface CharacterTrainingDataset {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  triggerWord: string;
  sourceReferenceAssetIds: readonly string[];
  items: readonly CharacterDatasetCandidate[];
  captions: readonly CharacterCaptionRecord[];
  upscales: readonly CharacterUpscaleResult[];
  rejectedItemIds: readonly string[];
  authority: 'DIRECTOR_CHARACTER_DATASET';
}

export type CharacterTrainingTarget = 'local' | 'remote-gpu';

export interface CharacterLoraTrainingRequest {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  datasetId: string;
  triggerWord: string;
  baseModel: string;
  modalities: readonly ('image' | 'video')[];
  executionTarget: CharacterTrainingTarget;
  maxTrainingResolution: number;
  saveEverySteps: number;
  sampleEverySteps: number;
  samplePrompts: readonly string[];
  evidenceIds: readonly string[];
}

export interface CharacterLoraCheckpoint {
  id: string;
  trainingRequestId: string;
  step: number;
  assetUri: string;
  sha256: string;
  sampleIdentityScore: number;
  sampleQualityScore: number;
  overfitScore: number;
  evidenceIds: readonly string[];
}

export interface CharacterLoraCheckpointPolicy {
  minimumIdentityScore: number;
  minimumQualityScore: number;
  maximumOverfitScore: number;
}

export interface CharacterLoraPromotion {
  checkpoint: CharacterLoraCheckpoint;
  lora: LoRARecord;
  authority: 'DIRECTOR_CHARACTER_LORA_PROMOTION';
}

export function validateCharacterTrainingDataset(
  dataset: CharacterTrainingDataset,
  policy: CharacterDatasetPolicy,
): readonly string[] {
  const reasons: string[] = [];
  if (
    !dataset.id.trim() ||
    !dataset.projectId.trim() ||
    !dataset.characterId.trim() ||
    !dataset.continuityRef.trim()
  ) {
    reasons.push('DIRECTOR_CHARACTER_DATASET_IDENTITY_REQUIRED');
  }
  if (!isValidTriggerWord(dataset.triggerWord)) {
    reasons.push('DIRECTOR_CHARACTER_DATASET_TRIGGER_WORD_INVALID');
  }
  if (dataset.items.length < policy.minimumItems) reasons.push('DIRECTOR_CHARACTER_DATASET_TOO_SMALL');
  if (dataset.items.length > policy.maximumItems) reasons.push('DIRECTOR_CHARACTER_DATASET_TOO_LARGE');

  const captions = new Map(dataset.captions.map((caption) => [caption.datasetItemId, caption]));
  const upscales = new Map(dataset.upscales.map((upscale) => [upscale.datasetItemId, upscale]));
  const duplicateCounts = new Map<string, number>();

  for (const item of dataset.items) {
    if (!item.parentAssetIds.length) reasons.push(`DIRECTOR_CHARACTER_DATASET_PARENT_REQUIRED:${item.id}`);
    if (!item.evidenceIds.length) reasons.push(`DIRECTOR_CHARACTER_DATASET_EVIDENCE_REQUIRED:${item.id}`);
    if (!scoreOk(item.identityScore, policy.minimumIdentityScore)) reasons.push(`DIRECTOR_CHARACTER_DATASET_IDENTITY_LOW:${item.id}`);
    if (!scoreOk(item.anatomyScore, policy.minimumAnatomyScore)) reasons.push(`DIRECTOR_CHARACTER_DATASET_ANATOMY_LOW:${item.id}`);
    if (!scoreOk(item.qualityScore, policy.minimumQualityScore)) reasons.push(`DIRECTOR_CHARACTER_DATASET_QUALITY_LOW:${item.id}`);

    if (item.duplicateGroup) {
      const count = (duplicateCounts.get(item.duplicateGroup) ?? 0) + 1;
      duplicateCounts.set(item.duplicateGroup, count);
      if (count > policy.maximumPerDuplicateGroup) {
        reasons.push(`DIRECTOR_CHARACTER_DATASET_DUPLICATE_OVERREPRESENTED:${item.duplicateGroup}`);
      }
    }

    const caption = captions.get(item.id);
    if (!caption) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_CAPTION_REQUIRED:${item.id}`);
    } else {
      if (!caption.caption.includes(dataset.triggerWord)) {
        reasons.push(`DIRECTOR_CHARACTER_DATASET_TRIGGER_WORD_MISSING:${item.id}`);
      }
      if (!caption.evidenceIds.length) reasons.push(`DIRECTOR_CHARACTER_DATASET_CAPTION_EVIDENCE_REQUIRED:${item.id}`);
    }

    const upscale = upscales.get(item.id);
    if (!upscale) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_UPSCALE_REQUIRED:${item.id}`);
    } else {
      if (!scoreOk(upscale.identitySimilarity, policy.minimumUpscaleIdentitySimilarity)) {
        reasons.push(`DIRECTOR_CHARACTER_DATASET_UPSCALE_IDENTITY_LOW:${item.id}`);
      }
      if (!scoreOk(upscale.qualityScore, policy.minimumUpscaleQualityScore)) {
        reasons.push(`DIRECTOR_CHARACTER_DATASET_UPSCALE_QUALITY_LOW:${item.id}`);
      }
      if (!Number.isFinite(upscale.fidelityBias) || upscale.fidelityBias < 0 || upscale.fidelityBias > 1) {
        reasons.push(`DIRECTOR_CHARACTER_DATASET_UPSCALE_FIDELITY_INVALID:${item.id}`);
      }
      if (!upscale.evidenceIds.length) reasons.push(`DIRECTOR_CHARACTER_DATASET_UPSCALE_EVIDENCE_REQUIRED:${item.id}`);
    }
  }

  for (const requiredView of policy.requireViews) {
    if (!dataset.items.some((item) => item.view === requiredView)) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_VIEW_REQUIRED:${requiredView}`);
    }
  }
  for (const requiredKind of policy.requireKinds) {
    if (!dataset.items.some((item) => item.kind === requiredKind)) {
      reasons.push(`DIRECTOR_CHARACTER_DATASET_KIND_REQUIRED:${requiredKind}`);
    }
  }

  const activeIds = new Set(dataset.items.map((item) => item.id));
  for (const rejectedId of dataset.rejectedItemIds) {
    if (activeIds.has(rejectedId)) reasons.push(`DIRECTOR_CHARACTER_DATASET_REJECTED_ITEM_ACTIVE:${rejectedId}`);
  }

  return Object.freeze([...new Set(reasons)]);
}

export function curateCharacterDataset(
  candidates: readonly CharacterDatasetCandidate[],
  policy: Pick<
    CharacterDatasetPolicy,
    'minimumIdentityScore' | 'minimumAnatomyScore' | 'minimumQualityScore' | 'maximumPerDuplicateGroup'
  >,
): {
  accepted: readonly CharacterDatasetCandidate[];
  rejected: readonly CharacterDatasetCandidate[];
} {
  const accepted: CharacterDatasetCandidate[] = [];
  const rejected: CharacterDatasetCandidate[] = [];
  const duplicateCounts = new Map<string, number>();

  const ordered = [...candidates].sort((a, b) =>
    b.identityScore - a.identityScore ||
    b.qualityScore - a.qualityScore ||
    b.anatomyScore - a.anatomyScore ||
    a.id.localeCompare(b.id),
  );

  for (const candidate of ordered) {
    const valid =
      scoreOk(candidate.identityScore, policy.minimumIdentityScore) &&
      scoreOk(candidate.anatomyScore, policy.minimumAnatomyScore) &&
      scoreOk(candidate.qualityScore, policy.minimumQualityScore) &&
      candidate.parentAssetIds.length > 0 &&
      candidate.evidenceIds.length > 0;

    if (!valid) {
      rejected.push(candidate);
      continue;
    }

    if (candidate.duplicateGroup) {
      const count = duplicateCounts.get(candidate.duplicateGroup) ?? 0;
      if (count >= policy.maximumPerDuplicateGroup) {
        rejected.push(candidate);
        continue;
      }
      duplicateCounts.set(candidate.duplicateGroup, count + 1);
    }

    accepted.push(candidate);
  }

  return Object.freeze({
    accepted: Object.freeze(accepted),
    rejected: Object.freeze(rejected),
  });
}

export function validateCharacterLoraTrainingRequest(
  request: CharacterLoraTrainingRequest,
): readonly string[] {
  const reasons: string[] = [];
  if (
    !request.id.trim() ||
    !request.projectId.trim() ||
    !request.characterId.trim() ||
    !request.continuityRef.trim() ||
    !request.datasetId.trim() ||
    !request.baseModel.trim()
  ) {
    reasons.push('DIRECTOR_CHARACTER_LORA_TRAINING_IDENTITY_REQUIRED');
  }
  if (!isValidTriggerWord(request.triggerWord)) reasons.push('DIRECTOR_CHARACTER_LORA_TRIGGER_WORD_INVALID');
  if (!request.modalities.length) reasons.push('DIRECTOR_CHARACTER_LORA_MODALITY_REQUIRED');
  if (!Number.isInteger(request.maxTrainingResolution) || request.maxTrainingResolution < 256) {
    reasons.push('DIRECTOR_CHARACTER_LORA_RESOLUTION_INVALID');
  }
  if (!Number.isInteger(request.saveEverySteps) || request.saveEverySteps <= 0) {
    reasons.push('DIRECTOR_CHARACTER_LORA_SAVE_INTERVAL_INVALID');
  }
  if (!Number.isInteger(request.sampleEverySteps) || request.sampleEverySteps <= 0) {
    reasons.push('DIRECTOR_CHARACTER_LORA_SAMPLE_INTERVAL_INVALID');
  }
  if (!request.samplePrompts.length) reasons.push('DIRECTOR_CHARACTER_LORA_SAMPLE_PROMPTS_REQUIRED');
  if (request.samplePrompts.some((prompt) => !prompt.includes(request.triggerWord))) {
    reasons.push('DIRECTOR_CHARACTER_LORA_SAMPLE_TRIGGER_WORD_REQUIRED');
  }
  if (!request.evidenceIds.length) reasons.push('DIRECTOR_CHARACTER_LORA_TRAINING_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function selectCharacterLoraCheckpoint(
  checkpoints: readonly CharacterLoraCheckpoint[],
  policy: CharacterLoraCheckpointPolicy,
): CharacterLoraCheckpoint | undefined {
  return [...checkpoints]
    .filter((checkpoint) =>
      checkpoint.step > 0 &&
      checkpoint.assetUri.trim() &&
      checkpoint.sha256.trim() &&
      checkpoint.evidenceIds.length > 0 &&
      scoreOk(checkpoint.sampleIdentityScore, policy.minimumIdentityScore) &&
      scoreOk(checkpoint.sampleQualityScore, policy.minimumQualityScore) &&
      Number.isFinite(checkpoint.overfitScore) &&
      checkpoint.overfitScore >= 0 &&
      checkpoint.overfitScore <= policy.maximumOverfitScore,
    )
    .sort((a, b) =>
      checkpointScore(b) - checkpointScore(a) ||
      b.step - a.step ||
      a.id.localeCompare(b.id),
    )[0];
}

export function promoteCharacterLora(
  request: CharacterLoraTrainingRequest,
  checkpoint: CharacterLoraCheckpoint,
): CharacterLoraPromotion {
  const reasons = validateCharacterLoraTrainingRequest(request);
  if (reasons.length) throw new Error(`DIRECTOR_CHARACTER_LORA_TRAINING_INVALID: ${reasons.join(', ')}`);
  if (checkpoint.trainingRequestId !== request.id) {
    throw new Error('DIRECTOR_CHARACTER_LORA_CHECKPOINT_REQUEST_MISMATCH');
  }

  const lora: LoRARecord = Object.freeze({
    id: `character:${request.characterId}:lora:${checkpoint.id}`,
    name: `Character LoRA — ${request.characterId}`,
    version: String(checkpoint.step),
    baseModel: request.baseModel,
    triggerWords: [request.triggerWord],
    modalities: [...request.modalities],
    weight: { min: 0, max: 1.5, recommended: 0.9 },
    uri: checkpoint.assetUri,
    sha256: checkpoint.sha256,
    metadata: {
      status: 'candidate-character-lora',
      characterId: request.characterId,
      continuityRef: request.continuityRef,
      datasetId: request.datasetId,
      trainingRequestId: request.id,
      checkpointId: checkpoint.id,
      executionTarget: request.executionTarget,
      sampleIdentityScore: checkpoint.sampleIdentityScore,
      sampleQualityScore: checkpoint.sampleQualityScore,
      overfitScore: checkpoint.overfitScore,
    },
  });

  return Object.freeze({
    checkpoint,
    lora,
    authority: 'DIRECTOR_CHARACTER_LORA_PROMOTION',
  });
}

function scoreOk(value: number, minimum: number): boolean {
  return Number.isFinite(value) && value >= minimum && value <= 1;
}

function isValidTriggerWord(value: string): boolean {
  const word = value.trim();
  return /^[A-Za-z][A-Za-z0-9_-]{3,63}$/.test(word);
}

function checkpointScore(checkpoint: CharacterLoraCheckpoint): number {
  return checkpoint.sampleIdentityScore * 0.55 +
    checkpoint.sampleQualityScore * 0.35 +
    (1 - checkpoint.overfitScore) * 0.1;
}
