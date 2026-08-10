export type CharacterArchetype = "human" | "cartoon" | "puppet" | "creature";

export interface CharacterBehaviorDNA {
  characterId: string;
  archetype: CharacterArchetype;
  traits: string[];
  breathing: { enabled: boolean; ratePerMinute: number; variability: number };
  movement: { gait: string; pace: number; idleVariation: number };
  speech: { cadence: number; pauseVariation: number; overlapTolerance: number };
  eating: { enabled: boolean; tempo: number; biteVariation: number };
  social: { eyeContact: number; personalSpace: number; gestureFrequency: number; reactionDelayMs: number };
  continuity: { preserveAcrossScenes: boolean; lastUpdatedAt: string };
}

export const defaultHumanBehaviorDNA = (characterId: string): CharacterBehaviorDNA => ({
  characterId,
  archetype: "human",
  traits: ["breathes", "walks", "speaks", "listens", "reacts", "eats", "rests"],
  breathing: { enabled: true, ratePerMinute: 14, variability: 0.18 },
  movement: { gait: "natural", pace: 1, idleVariation: 0.2 },
  speech: { cadence: 1, pauseVariation: 0.2, overlapTolerance: 0.08 },
  eating: { enabled: true, tempo: 1, biteVariation: 0.2 },
  social: { eyeContact: 0.7, personalSpace: 0.65, gestureFrequency: 0.55, reactionDelayMs: 350 },
  continuity: { preserveAcrossScenes: true, lastUpdatedAt: new Date().toISOString() },
});

export function mergeCharacterDNA(base: CharacterBehaviorDNA, updates: Partial<CharacterBehaviorDNA>): CharacterBehaviorDNA {
  return {
    ...base,
    ...updates,
    breathing: { ...base.breathing, ...updates.breathing },
    movement: { ...base.movement, ...updates.movement },
    speech: { ...base.speech, ...updates.speech },
    eating: { ...base.eating, ...updates.eating },
    social: { ...base.social, ...updates.social },
    continuity: { ...base.continuity, ...updates.continuity, lastUpdatedAt: new Date().toISOString() },
  };
}
