import type { GrowthId } from '../domain/types.js';

export type SocialHookMechanic =
  | 'curiosity_gap'
  | 'direct_question'
  | 'contrast'
  | 'problem_solution'
  | 'unexpected_twist'
  | 'emotional_confession'
  | 'direct_benefit'
  | 'immediate_tension'
  | 'proof_number'
  | 'story_cold_open'
  | 'reveal'
  | 'pattern_interrupt'
  | 'identity_signal'
  | 'status_contrast'
  | 'continuation';

export type SocialRetentionMechanic =
  | 'open_loop'
  | 'escalation'
  | 'visual_change'
  | 'audio_change'
  | 'proof'
  | 'counterexample'
  | 'payoff'
  | 'reveal'
  | 'callback'
  | 'cta';

export interface SocialRetentionBeat {
  atSecond: number;
  mechanic: SocialRetentionMechanic;
  purpose: string;
  evidenceRefs: readonly string[];
}

export interface SocialCreativeMechanicObservation {
  id: GrowthId;
  platform: string;
  sourceRef: string;
  topic: string;
  hookMechanic: SocialHookMechanic;
  hookWindowSeconds: number;
  retentionBeats: readonly SocialRetentionBeat[];
  audienceIntent: string;
  format: string;
  performanceEvidenceRefs: readonly string[];
  observedAt: string;
}

export interface SocialCreativeMechanicHypothesis {
  id: GrowthId;
  sourceObservationId: GrowthId;
  platform: string;
  hookMechanic: SocialHookMechanic;
  hookWindowSeconds: number;
  retentionBeats: readonly Readonly<{
    relativeOrder: number;
    mechanic: SocialRetentionMechanic;
    timingBand: 'opening' | 'early' | 'middle' | 'late';
    purpose: string;
    evidenceRefs: readonly string[];
  }>[];
  audienceIntent: string;
  format: string;
  sourceExpressionReuseAuthorized: false;
  identityImitationAuthorized: false;
  abstractionLaw: 'LEARN_STRUCTURE_NOT_EXPRESSION';
  authority: 'CREATIVE_HYPOTHESIS_ONLY';
  evidenceRefs: readonly string[];
}

export type StoryBankMaterialKind =
  | 'moment'
  | 'number'
  | 'correction'
  | 'opposition'
  | 'ask'
  | 'proof'
  | 'position'
  | 'anecdote'
  | 'scar'
  | 'turning_point';

export type StoryBankSource =
  | 'owner_interview'
  | 'owner_supplied'
  | 'operational_evidence';

export interface SocialStoryBankEntry {
  id: GrowthId;
  subjectId: GrowthId;
  kind: StoryBankMaterialKind;
  source: StoryBankSource;
  text: string;
  happenedAt?: string;
  numericValue?: number;
  numericUnit?: string;
  namingPolicy: 'public' | 'anonymous' | 'restricted';
  publicUseAuthorized: boolean;
  evidenceRefs: readonly string[];
  recordedAt: string;
  authority: 'STORY_MATERIAL_ONLY';
}

export function abstractCreativeMechanic(
  observation: SocialCreativeMechanicObservation,
): SocialCreativeMechanicHypothesis {
  validateObservation(observation);

  const beats = [...observation.retentionBeats]
    .sort((a, b) => a.atSecond - b.atSecond)
    .map((beat, index) => Object.freeze({
      relativeOrder: index + 1,
      mechanic: beat.mechanic,
      timingBand: timingBand(beat.atSecond),
      purpose: beat.purpose.trim(),
      evidenceRefs: Object.freeze(unique(beat.evidenceRefs)),
    }));

  return Object.freeze({
    id: `mechanic-hypothesis:${safe(observation.id)}` as GrowthId,
    sourceObservationId: observation.id,
    platform: observation.platform.trim().toLowerCase(),
    hookMechanic: observation.hookMechanic,
    hookWindowSeconds: observation.hookWindowSeconds,
    retentionBeats: Object.freeze(beats),
    audienceIntent: observation.audienceIntent.trim(),
    format: observation.format.trim(),
    sourceExpressionReuseAuthorized: false as const,
    identityImitationAuthorized: false as const,
    abstractionLaw: 'LEARN_STRUCTURE_NOT_EXPRESSION' as const,
    authority: 'CREATIVE_HYPOTHESIS_ONLY' as const,
    evidenceRefs: Object.freeze(unique([
      observation.sourceRef,
      ...observation.performanceEvidenceRefs,
      ...observation.retentionBeats.flatMap((beat) => beat.evidenceRefs),
    ])),
  });
}

export function createSocialStoryBankEntry(input: {
  id: GrowthId;
  subjectId: GrowthId;
  kind: StoryBankMaterialKind;
  source: StoryBankSource;
  text: string;
  happenedAt?: string;
  numericValue?: number;
  numericUnit?: string;
  namingPolicy: 'public' | 'anonymous' | 'restricted';
  evidenceRefs: readonly string[];
  recordedAt?: string;
}): SocialStoryBankEntry {
  requireText(input.id, 'id');
  requireText(input.subjectId, 'subjectId');
  requireText(input.text, 'text');
  if (!input.evidenceRefs.length) {
    throw new Error('SOCIAL_STORY_BANK_EVIDENCE_REQUIRED');
  }
  if (input.happenedAt && !Number.isFinite(Date.parse(input.happenedAt))) {
    throw new Error('SOCIAL_STORY_BANK_HAPPENED_AT_INVALID');
  }
  if (input.numericValue !== undefined && !Number.isFinite(input.numericValue)) {
    throw new Error('SOCIAL_STORY_BANK_NUMBER_INVALID');
  }
  if (input.numericValue !== undefined && !input.numericUnit?.trim()) {
    throw new Error('SOCIAL_STORY_BANK_NUMBER_UNIT_REQUIRED');
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(recordedAt))) {
    throw new Error('SOCIAL_STORY_BANK_RECORDED_AT_INVALID');
  }

  return Object.freeze({
    id: input.id,
    subjectId: input.subjectId,
    kind: input.kind,
    source: input.source,
    text: input.text.trim(),
    happenedAt: input.happenedAt,
    numericValue: input.numericValue,
    numericUnit: input.numericUnit?.trim(),
    namingPolicy: input.namingPolicy,
    publicUseAuthorized: input.namingPolicy !== 'restricted',
    evidenceRefs: Object.freeze(unique(input.evidenceRefs)),
    recordedAt,
    authority: 'STORY_MATERIAL_ONLY' as const,
  });
}

export function eligibleStoryMaterial(
  entries: readonly SocialStoryBankEntry[],
): SocialStoryBankEntry[] {
  return entries.filter((entry) => entry.publicUseAuthorized);
}

function validateObservation(observation: SocialCreativeMechanicObservation): void {
  requireText(observation.id, 'observation.id');
  requireText(observation.platform, 'observation.platform');
  requireText(observation.sourceRef, 'observation.sourceRef');
  requireText(observation.topic, 'observation.topic');
  requireText(observation.audienceIntent, 'observation.audienceIntent');
  requireText(observation.format, 'observation.format');

  if (
    !Number.isFinite(observation.hookWindowSeconds)
    || observation.hookWindowSeconds <= 0
    || observation.hookWindowSeconds > 15
  ) {
    throw new Error('SOCIAL_CREATIVE_HOOK_WINDOW_INVALID');
  }
  if (!observation.performanceEvidenceRefs.length) {
    throw new Error('SOCIAL_CREATIVE_PERFORMANCE_EVIDENCE_REQUIRED');
  }
  if (!Number.isFinite(Date.parse(observation.observedAt))) {
    throw new Error('SOCIAL_CREATIVE_OBSERVED_AT_INVALID');
  }

  for (const beat of observation.retentionBeats) {
    if (!Number.isFinite(beat.atSecond) || beat.atSecond < 0) {
      throw new Error('SOCIAL_CREATIVE_RETENTION_TIME_INVALID');
    }
    requireText(beat.purpose, 'retentionBeat.purpose');
    if (!beat.evidenceRefs.length) {
      throw new Error('SOCIAL_CREATIVE_RETENTION_EVIDENCE_REQUIRED');
    }
  }
}

function timingBand(second: number): 'opening' | 'early' | 'middle' | 'late' {
  if (second <= 3) return 'opening';
  if (second <= 10) return 'early';
  if (second <= 30) return 'middle';
  return 'late';
}

function requireText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`SOCIAL_CREATIVE_FIELD_REQUIRED:${field}`);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function safe(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]+/g, '-').slice(0, 140);
}
