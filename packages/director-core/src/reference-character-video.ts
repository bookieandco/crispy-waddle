import type { AskVideoCreationIntent } from './ask-video-production';
import type { CharacterCastRecord } from './cast-bible';
import type { CharacterReferenceBootstrapPlan } from './character-reference-bootstrap';

export type ReferenceCharacterVideoStage =
  | 'character-bootstrap'
  | 'cast-lock'
  | 'script'
  | 'storyboard'
  | 'shotlist'
  | 'reference-selection'
  | 'take-generation'
  | 'take-observation'
  | 'take-selection'
  | 'dialogue'
  | 'voice-sync'
  | 'foley'
  | 'score'
  | 'edit'
  | 'render'
  | 'qc'
  | 'preview';

export interface ReferenceCharacterVideoRequest {
  id: string;
  projectId: string;
  prompt: string;
  intent: AskVideoCreationIntent;
  bootstrapPlan: CharacterReferenceBootstrapPlan;
  cast: CharacterCastRecord;
  defaultAppearanceVariantId: string;
  dialogueRequired: boolean;
  targetLanguages?: readonly string[];
  sceneAppearanceOverrides?: Readonly<Record<string, string>>;
}

export interface ReferenceCharacterVideoPlan {
  id: string;
  projectId: string;
  characterId: string;
  continuityRef: string;
  defaultAppearanceVariantId: string;
  targetLanguages: readonly string[];
  stages: readonly ReferenceCharacterVideoStage[];
  providerPolicy: AskVideoCreationIntent['providerPolicy'];
  authority: 'DIRECTOR_PRODUCTION_PLAN';
}

export interface ReferenceCharacterVideoDecision {
  valid: boolean;
  reasons: readonly string[];
}

export function validateReferenceCharacterVideoRequest(
  request: ReferenceCharacterVideoRequest,
): ReferenceCharacterVideoDecision {
  const reasons: string[] = [];
  if (!request.id.trim() || !request.projectId.trim() || !request.prompt.trim()) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_IDENTITY_REQUIRED');
  }
  if (request.bootstrapPlan.projectId !== request.projectId || request.cast.projectId !== request.projectId) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_PROJECT_MISMATCH');
  }
  if (request.bootstrapPlan.characterId !== request.cast.characterId) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_CHARACTER_MISMATCH');
  }
  if (request.bootstrapPlan.continuityRef !== request.cast.continuityRef) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_CONTINUITY_MISMATCH');
  }
  if (!request.cast.appearanceVariants.some((variant) => variant.id === request.defaultAppearanceVariantId)) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_APPEARANCE_UNKNOWN');
  }
  for (const appearanceId of Object.values(request.sceneAppearanceOverrides ?? {})) {
    if (!request.cast.appearanceVariants.some((variant) => variant.id === appearanceId)) {
      reasons.push(`DIRECTOR_REFERENCE_VIDEO_SCENE_APPEARANCE_UNKNOWN:${appearanceId}`);
    }
  }
  if (request.dialogueRequired && !request.cast.voice) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_VOICE_REQUIRED');
  }
  if (request.targetLanguages?.length && !request.cast.voice) {
    reasons.push('DIRECTOR_REFERENCE_VIDEO_MULTILINGUAL_VOICE_REQUIRED');
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function planReferenceCharacterVideo(
  request: ReferenceCharacterVideoRequest,
): ReferenceCharacterVideoPlan {
  const decision = validateReferenceCharacterVideoRequest(request);
  if (!decision.valid) throw new Error(decision.reasons.join(';'));

  const stages: ReferenceCharacterVideoStage[] = [
    'character-bootstrap',
    'cast-lock',
    'script',
    'storyboard',
    'shotlist',
    'reference-selection',
    'take-generation',
    'take-observation',
    'take-selection',
    ...(request.dialogueRequired ? ['dialogue' as const, 'voice-sync' as const] : []),
    'foley',
    'score',
    'edit',
    'render',
    'qc',
    'preview',
  ];

  return Object.freeze({
    id: request.id,
    projectId: request.projectId,
    characterId: request.cast.characterId,
    continuityRef: request.cast.continuityRef,
    defaultAppearanceVariantId: request.defaultAppearanceVariantId,
    targetLanguages: Object.freeze([...(request.targetLanguages ?? [request.cast.voice?.primaryLanguage ?? 'und'])]),
    stages: Object.freeze(stages),
    providerPolicy: request.intent.providerPolicy,
    authority: 'DIRECTOR_PRODUCTION_PLAN',
  });
}
