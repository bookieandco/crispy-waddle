export type PersonalityLayer = 'rules' | 'identity' | 'expression' | 'decisions' | 'interpersonal' | 'correction';

export interface PersonalitySlider {
  value: number;
  confidence: number;
  sourceExperienceIds: string[];
}

export interface PersonalityEvidence {
  id: string;
  ownerId: string;
  layer: PersonalityLayer;
  trait: string;
  value: number;
  confidence: number;
  sourceExperienceIds: string[];
  createdAt: string;
}

export interface PersonalityProfile {
  ownerId: string;
  sliders: Record<string, PersonalitySlider>;
  evidence: PersonalityEvidence[];
  revision: number;
}

export interface PersonalityDistiller {
  addEvidence(profile: PersonalityProfile, evidence: PersonalityEvidence): PersonalityProfile;
  applyCorrection(profile: PersonalityProfile, trait: string, value: number, sourceExperienceId: string): PersonalityProfile;
}

export function createPersonalityDistiller(): PersonalityDistiller {
  return {
    addEvidence(profile, evidence) {
      if (evidence.ownerId !== profile.ownerId) return profile;
      const current = profile.sliders[evidence.trait];
      const nextValue = current
        ? Math.round((current.value * current.confidence + evidence.value * evidence.confidence) / (current.confidence + evidence.confidence))
        : evidence.value;
      const nextConfidence = Math.min(95, Math.round((current?.confidence ?? 0) + evidence.confidence * 0.15));
      return {
        ...profile,
        revision: profile.revision + 1,
        sliders: { ...profile.sliders, [evidence.trait]: { value: nextValue, confidence: nextConfidence, sourceExperienceIds: [...new Set([...(current?.sourceExperienceIds ?? []), ...evidence.sourceExperienceIds])] } },
        evidence: [...profile.evidence, evidence],
      };
    },
    applyCorrection(profile, trait, value, sourceExperienceId) {
      return {
        ...profile,
        revision: profile.revision + 1,
        sliders: { ...profile.sliders, [trait]: { value, confidence: 95, sourceExperienceIds: [...new Set([...(profile.sliders[trait]?.sourceExperienceIds ?? []), sourceExperienceId])] } },
      };
    },
  };
}
