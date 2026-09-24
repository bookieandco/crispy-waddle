import {
  validateGenerationReferenceManifest,
  type GenerationReferenceManifest,
  type OrderedGenerationReference,
} from './generation-reference-manifest.js';

export type ContinuityTechnique =
  | 'identity-sheet'
  | 'voice-lock'
  | 'environment-elements'
  | 'burst-angle-pack'
  | 'storyboard-batch'
  | 'start-end-frames'
  | 'chained-references';

export type ContinuityMotionScale = 'small' | 'medium' | 'large';
export type CharacterSheetPanelKind =
  | 'face-close-up'
  | 'body-front'
  | 'body-back'
  | 'silhouette'
  | 'wardrobe'
  | 'style-anchor';

export interface CharacterSheetPanel {
  id: string;
  assetId: string;
  sha256: string;
  kind: CharacterSheetPanelKind;
  faceVisible: boolean;
  neutralBackground: boolean;
  neutralLighting: boolean;
  scaleGroup?: string;
  evidenceIds: readonly string[];
}

export interface CharacterIdentitySheet {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  canonicalFacePanelId: string;
  panels: readonly CharacterSheetPanel[];
  identityTraits: readonly string[];
  silhouetteTraits?: readonly string[];
  colorTraits?: readonly string[];
  version: number;
  approvedAt: string;
  approvedBy: string;
}

export interface EnvironmentViewReference {
  id: string;
  assetId: string;
  sha256: string;
  viewLabel: string;
  source: 'authored' | 'burst-extracted' | 'chained';
  parentAssetIds: readonly string[];
  evidenceIds: readonly string[];
}

export interface EnvironmentViewPack {
  id: string;
  projectId: string;
  environmentId: string;
  canonicalAssetId: string;
  views: readonly EnvironmentViewReference[];
  styleReferenceAssetIds?: readonly string[];
  version: number;
}

export interface VoiceContinuityReference {
  characterId: string;
  voiceIdentityId: string;
  assetId: string;
  media: 'audio' | 'video';
  transport: 'audio-sample' | 'black-video-wrapper' | 'provider-voice-id';
  evidenceIds: readonly string[];
}

export interface StoryboardContinuityBatch {
  id: string;
  frameIds: readonly string[];
}

export interface ContinuityShotRequest {
  id: string;
  projectId: string;
  shotId: string;
  characterSheets: readonly CharacterIdentitySheet[];
  voiceReferences?: readonly VoiceContinuityReference[];
  environmentPack?: EnvironmentViewPack;
  firstFrameAssetId?: string;
  lastFrameAssetId?: string;
  styleReferenceAssetIds?: readonly string[];
  compositionReferenceAssetIds?: readonly string[];
  priorShotReferenceAssetIds?: readonly string[];
  storyboardFrameIds?: readonly string[];
  targetEnvironmentAngles?: readonly string[];
  dialogueCharacterIds?: readonly string[];
  motionScale: ContinuityMotionScale;
  preserveEnvironment: boolean;
  exactCompositionControl?: boolean;
  continuousShot?: boolean;
}

export interface ContinuityStrategyPlan {
  id: string;
  projectId: string;
  shotId: string;
  techniques: readonly ContinuityTechnique[];
  storyboardBatches: readonly StoryboardContinuityBatch[];
  singleContinuousShot: boolean;
  referenceManifest: GenerationReferenceManifest;
  reasons: readonly string[];
  authority: 'DIRECTOR_CONTINUITY_STRATEGY';
}

export interface ContinuityQcObservation {
  dimension:
    | 'face-identity'
    | 'body-silhouette'
    | 'wardrobe'
    | 'style'
    | 'voice'
    | 'environment'
    | 'first-frame'
    | 'last-frame';
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
}

export interface ContinuityQcDecision {
  admissible: boolean;
  reasons: readonly string[];
  authority: 'DIRECTOR_CONTINUITY_QC';
}

export function validateCharacterIdentitySheet(sheet: CharacterIdentitySheet): readonly string[] {
  const reasons: string[] = [];
  if (!sheet.id.trim() || !sheet.projectId.trim() || !sheet.characterId.trim() || !sheet.continuityRef.trim()) {
    reasons.push('DIRECTOR_CONTINUITY_SHEET_IDENTITY_REQUIRED');
  }
  if (!sheet.panels.length) reasons.push('DIRECTOR_CONTINUITY_SHEET_PANELS_REQUIRED');
  if (!sheet.identityTraits.length) reasons.push('DIRECTOR_CONTINUITY_IDENTITY_TRAITS_REQUIRED');

  const canonical = sheet.panels.find((panel) => panel.id === sheet.canonicalFacePanelId);
  if (!canonical) {
    reasons.push('DIRECTOR_CONTINUITY_CANONICAL_FACE_UNKNOWN');
  } else {
    if (canonical.kind !== 'face-close-up') reasons.push('DIRECTOR_CONTINUITY_CANONICAL_FACE_MUST_BE_CLOSEUP');
    if (!canonical.faceVisible) reasons.push('DIRECTOR_CONTINUITY_CANONICAL_FACE_NOT_VISIBLE');
  }

  const facePanels = sheet.panels.filter((panel) => panel.faceVisible);
  if (facePanels.length !== 1) {
    reasons.push('DIRECTOR_CONTINUITY_SINGLE_FACE_ANCHOR_REQUIRED');
  }

  const bodyPanels = sheet.panels.filter((panel) => panel.kind === 'body-front' || panel.kind === 'body-back');
  if (!bodyPanels.length) reasons.push('DIRECTOR_CONTINUITY_BODY_PANEL_REQUIRED');
  for (const panel of bodyPanels) {
    if (panel.faceVisible) reasons.push(`DIRECTOR_CONTINUITY_BODY_PANEL_FACE_CONFLICT:${panel.id}`);
  }

  for (const panel of sheet.panels) {
    if (!panel.assetId.trim() || !panel.sha256.trim()) reasons.push(`DIRECTOR_CONTINUITY_PANEL_ASSET_REQUIRED:${panel.id}`);
    if (!panel.evidenceIds.length) reasons.push(`DIRECTOR_CONTINUITY_PANEL_EVIDENCE_REQUIRED:${panel.id}`);
    if (!panel.neutralBackground) reasons.push(`DIRECTOR_CONTINUITY_PANEL_BACKGROUND_NOT_NEUTRAL:${panel.id}`);
    if (!panel.neutralLighting) reasons.push(`DIRECTOR_CONTINUITY_PANEL_LIGHTING_NOT_NEUTRAL:${panel.id}`);
  }

  const scaleGroups = new Set(bodyPanels.map((panel) => panel.scaleGroup).filter(Boolean));
  if (bodyPanels.length > 1 && scaleGroups.size > 1) {
    reasons.push('DIRECTOR_CONTINUITY_BODY_SCALE_MISMATCH');
  }

  return Object.freeze([...new Set(reasons)]);
}

export function validateEnvironmentViewPack(pack: EnvironmentViewPack): readonly string[] {
  const reasons: string[] = [];
  if (!pack.id.trim() || !pack.projectId.trim() || !pack.environmentId.trim() || !pack.canonicalAssetId.trim()) {
    reasons.push('DIRECTOR_CONTINUITY_ENVIRONMENT_IDENTITY_REQUIRED');
  }
  if (!pack.views.length) reasons.push('DIRECTOR_CONTINUITY_ENVIRONMENT_VIEWS_REQUIRED');
  const ids = new Set<string>();
  for (const view of pack.views) {
    if (ids.has(view.id)) reasons.push(`DIRECTOR_CONTINUITY_ENVIRONMENT_VIEW_DUPLICATE:${view.id}`);
    ids.add(view.id);
    if (!view.assetId.trim() || !view.sha256.trim() || !view.viewLabel.trim()) {
      reasons.push(`DIRECTOR_CONTINUITY_ENVIRONMENT_VIEW_INVALID:${view.id}`);
    }
    if (!view.evidenceIds.length) reasons.push(`DIRECTOR_CONTINUITY_ENVIRONMENT_VIEW_EVIDENCE_REQUIRED:${view.id}`);
    if (view.source === 'chained' && !view.parentAssetIds.length) {
      reasons.push(`DIRECTOR_CONTINUITY_CHAIN_PARENT_REQUIRED:${view.id}`);
    }
  }
  return Object.freeze([...new Set(reasons)]);
}

export function planContinuityStrategy(request: ContinuityShotRequest): ContinuityStrategyPlan {
  const reasons: string[] = [];
  const techniques: ContinuityTechnique[] = [];
  const references: OrderedGenerationReference[] = [];
  const seen = new Set<string>();

  const pushReference = (
    assetId: string | undefined,
    media: OrderedGenerationReference['media'],
    role: OrderedGenerationReference['role'],
    semanticLabel: string,
    promptToken: string,
    evidenceIds: readonly string[],
  ) => {
    if (!assetId?.trim() || seen.has(assetId)) return;
    seen.add(assetId);
    references.push({
      slot: references.length + 1,
      assetId,
      media,
      role,
      semanticLabel,
      promptToken,
      required: true,
      evidenceIds: [...evidenceIds],
    });
  };

  if (!request.id.trim() || !request.projectId.trim() || !request.shotId.trim()) {
    reasons.push('DIRECTOR_CONTINUITY_SHOT_IDENTITY_REQUIRED');
  }

  if (request.characterSheets.length) {
    techniques.push('identity-sheet');
    for (const sheet of request.characterSheets) {
      const sheetReasons = validateCharacterIdentitySheet(sheet);
      reasons.push(...sheetReasons.map((reason) => `${reason}:${sheet.characterId}`));
      const canonical = sheet.panels.find((panel) => panel.id === sheet.canonicalFacePanelId);
      pushReference(
        canonical?.assetId,
        'image',
        'character-identity',
        `canonical face identity for ${sheet.characterId}`,
        `CHARACTER_${sheet.characterId.toUpperCase()}_FACE`,
        canonical?.evidenceIds ?? [],
      );
      for (const panel of sheet.panels.filter((candidate) => candidate.kind === 'body-front' || candidate.kind === 'body-back')) {
        pushReference(
          panel.assetId,
          'image',
          'character-identity',
          `${panel.kind} body/silhouette reference for ${sheet.characterId}; face intentionally excluded`,
          `CHARACTER_${sheet.characterId.toUpperCase()}_${panel.kind.toUpperCase().replace(/-/g, '_')}`,
          panel.evidenceIds,
        );
      }
    }
  }

  const dialogueIds = new Set(request.dialogueCharacterIds ?? []);
  if (dialogueIds.size) {
    techniques.push('voice-lock');
    const voiceByCharacter = new Map((request.voiceReferences ?? []).map((reference) => [reference.characterId, reference]));
    for (const characterId of dialogueIds) {
      const reference = voiceByCharacter.get(characterId);
      if (!reference) {
        reasons.push(`DIRECTOR_CONTINUITY_VOICE_REFERENCE_REQUIRED:${characterId}`);
        continue;
      }
      pushReference(
        reference.assetId,
        reference.media,
        'audio',
        `canonical voice identity for ${characterId}; transport ${reference.transport}`,
        `VOICE_${characterId.toUpperCase()}`,
        reference.evidenceIds,
      );
    }
  }

  if (request.preserveEnvironment) {
    techniques.push('environment-elements');
    if (!request.environmentPack) {
      reasons.push('DIRECTOR_CONTINUITY_ENVIRONMENT_PACK_REQUIRED');
    } else {
      reasons.push(...validateEnvironmentViewPack(request.environmentPack));
      const canonicalView = request.environmentPack.views.find((view) => view.assetId === request.environmentPack!.canonicalAssetId)
        ?? request.environmentPack.views[0];
      pushReference(
        canonicalView?.assetId ?? request.environmentPack.canonicalAssetId,
        'image',
        'location',
        `canonical environment identity for ${request.environmentPack.environmentId}`,
        'ENVIRONMENT_CANONICAL',
        canonicalView?.evidenceIds ?? [],
      );
    }
  }

  if ((request.targetEnvironmentAngles?.length ?? 0) > 3) {
    techniques.push('burst-angle-pack');
    if (!request.environmentPack?.views.some((view) => view.source === 'burst-extracted')) {
      reasons.push('DIRECTOR_CONTINUITY_BURST_VIEW_PACK_REQUIRED');
    }
  }

  if (request.motionScale === 'large') {
    techniques.push('start-end-frames');
    if (!request.firstFrameAssetId?.trim()) reasons.push('DIRECTOR_CONTINUITY_FIRST_FRAME_REQUIRED_FOR_LARGE_MOTION');
    if (!request.lastFrameAssetId?.trim()) reasons.push('DIRECTOR_CONTINUITY_LAST_FRAME_REQUIRED_FOR_LARGE_MOTION');
  }

  pushReference(
    request.firstFrameAssetId,
    'image',
    'first-frame',
    'authored first-frame anchor',
    'FIRST_FRAME',
    ['continuity:first-frame'],
  );
  pushReference(
    request.lastFrameAssetId,
    'image',
    'last-frame',
    'authored last-frame anchor',
    'LAST_FRAME',
    ['continuity:last-frame'],
  );

  const storyboardBatches = buildStoryboardBatches(request.storyboardFrameIds ?? []);
  if (storyboardBatches.length) techniques.push('storyboard-batch');

  if (request.exactCompositionControl || (request.priorShotReferenceAssetIds?.length ?? 0) > 0) {
    techniques.push('chained-references');
    if (!request.priorShotReferenceAssetIds?.length) {
      reasons.push('DIRECTOR_CONTINUITY_CHAIN_REFERENCE_REQUIRED');
    }
  }

  for (const assetId of request.priorShotReferenceAssetIds ?? []) {
    pushReference(
      assetId,
      'image',
      'composition',
      'approved prior-shot continuity parent',
      `CHAIN_${references.length + 1}`,
      ['continuity:chain-parent'],
    );
  }

  for (const assetId of request.styleReferenceAssetIds ?? []) {
    pushReference(assetId, 'image', 'style', 'approved visual style anchor', `STYLE_${references.length + 1}`, ['continuity:style']);
  }
  for (const assetId of request.compositionReferenceAssetIds ?? []) {
    pushReference(assetId, 'image', 'composition', 'approved composition anchor', `COMPOSITION_${references.length + 1}`, ['continuity:composition']);
  }

  const referenceManifest: GenerationReferenceManifest = Object.freeze({
    id: `${request.id}:continuity-references`,
    projectId: request.projectId,
    shotId: request.shotId,
    references: Object.freeze(references.map((reference) => Object.freeze({
      ...reference,
      evidenceIds: Object.freeze([...reference.evidenceIds]),
    }))),
    authority: 'DIRECTOR_REFERENCE_MANIFEST',
  });

  if (references.length) {
    const manifestIssues = validateGenerationReferenceManifest(referenceManifest);
    reasons.push(...manifestIssues.map((issue) => `DIRECTOR_CONTINUITY_REFERENCE_MANIFEST:${issue.code}`));
  } else {
    reasons.push('DIRECTOR_CONTINUITY_REFERENCE_REQUIRED');
  }

  return Object.freeze({
    id: request.id,
    projectId: request.projectId,
    shotId: request.shotId,
    techniques: Object.freeze([...new Set(techniques)]),
    storyboardBatches: Object.freeze(storyboardBatches),
    singleContinuousShot: request.motionScale === 'large' ? true : Boolean(request.continuousShot),
    referenceManifest,
    reasons: Object.freeze([...new Set(reasons)]),
    authority: 'DIRECTOR_CONTINUITY_STRATEGY',
  });
}

export function assertContinuityStrategy(request: ContinuityShotRequest): ContinuityStrategyPlan {
  const plan = planContinuityStrategy(request);
  if (plan.reasons.length) throw new Error(`DIRECTOR_CONTINUITY_STRATEGY_INVALID: ${plan.reasons.join(', ')}`);
  return plan;
}

export function buildStoryboardBatches(frameIds: readonly string[], maxPanels = 4): readonly StoryboardContinuityBatch[] {
  if (!Number.isInteger(maxPanels) || maxPanels < 1 || maxPanels > 4) {
    throw new Error('DIRECTOR_CONTINUITY_STORYBOARD_BATCH_LIMIT_INVALID');
  }
  const unique = [...new Set(frameIds.filter((frameId) => frameId.trim()))];
  const batches: StoryboardContinuityBatch[] = [];
  for (let index = 0; index < unique.length; index += maxPanels) {
    batches.push(Object.freeze({
      id: `storyboard-batch:${batches.length + 1}`,
      frameIds: Object.freeze(unique.slice(index, index + maxPanels)),
    }));
  }
  return Object.freeze(batches);
}

export function evaluateContinuityQc(
  observations: readonly ContinuityQcObservation[],
  requiredDimensions: readonly ContinuityQcObservation['dimension'][],
  minimumScore = 0.8,
  minimumConfidence = 0.6,
): ContinuityQcDecision {
  const reasons: string[] = [];
  const byDimension = new Map(observations.map((observation) => [observation.dimension, observation]));

  for (const dimension of requiredDimensions) {
    const observation = byDimension.get(dimension);
    if (!observation) {
      reasons.push(`DIRECTOR_CONTINUITY_QC_MISSING:${dimension}`);
      continue;
    }
    if (!Number.isFinite(observation.score) || observation.score < minimumScore) {
      reasons.push(`DIRECTOR_CONTINUITY_QC_SCORE_LOW:${dimension}`);
    }
    if (!Number.isFinite(observation.confidence) || observation.confidence < minimumConfidence) {
      reasons.push(`DIRECTOR_CONTINUITY_QC_CONFIDENCE_LOW:${dimension}`);
    }
    if (!observation.evidenceIds.length) reasons.push(`DIRECTOR_CONTINUITY_QC_EVIDENCE_REQUIRED:${dimension}`);
  }

  return Object.freeze({
    admissible: reasons.length === 0,
    reasons: Object.freeze([...new Set(reasons)]),
    authority: 'DIRECTOR_CONTINUITY_QC',
  });
}
