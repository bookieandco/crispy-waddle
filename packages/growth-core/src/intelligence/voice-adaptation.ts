import type { GrowthId } from '../domain/types.js';
import type { CreativeAdaptationPlan } from './creative-adaptation.js';

export interface VoiceProfile {
  readonly id: GrowthId;
  readonly accountId: GrowthId;
  readonly traits: readonly string[];
  readonly preferredPhrases: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly intensity: number;
  readonly playfulness: number;
  readonly directness: number;
  readonly provenance: readonly string[];
}

export interface VoiceBoundAdaptation {
  readonly adaptationId: GrowthId;
  readonly voiceProfileId: GrowthId;
  readonly accountId: GrowthId;
  readonly tone: CreativeAdaptationPlan['tone'];
  readonly traits: readonly string[];
  readonly preferredPhrases: readonly string[];
  readonly forbiddenPatterns: readonly string[];
  readonly styleWeights: Readonly<{ intensity: number; playfulness: number; directness: number }>;
  readonly provenance: readonly string[];
  readonly requiresHumanReview: true;
}

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function bindVoiceToAdaptation(plan: CreativeAdaptationPlan, voice: VoiceProfile): VoiceBoundAdaptation {
  if (plan.accountId !== voice.accountId) throw new Error('VOICE_PROFILE_ACCOUNT_MISMATCH');
  return {
    adaptationId: plan.id,
    voiceProfileId: voice.id,
    accountId: plan.accountId,
    tone: plan.tone,
    traits: voice.traits,
    preferredPhrases: voice.preferredPhrases,
    forbiddenPatterns: voice.forbiddenPatterns,
    styleWeights: { intensity: clamp(voice.intensity), playfulness: clamp(voice.playfulness), directness: clamp(voice.directness) },
    provenance: [...plan.provenance, ...voice.provenance],
    requiresHumanReview: true,
  };
}
