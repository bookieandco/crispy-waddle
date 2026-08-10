export type SpeechState = "idle" | "speaking" | "listening" | "overlap" | "paused";
export type Emotion = "neutral" | "happy" | "sad" | "angry" | "surprised" | "confused" | "excited";

export interface CharacterInteractionState {
  characterId: string;
  emotion: Emotion;
  attentionTarget?: string;
  position: { x: number; y: number; z: number };
  speechState: SpeechState;
  currentAction?: string;
  relationshipTo?: Record<string, string>;
}

export interface InteractionBeat {
  id: string;
  characterId: string;
  atMs: number;
  durationMs: number;
  kind: "dialogue" | "gaze" | "reaction" | "gesture" | "movement" | "camera" | "pause";
  targetCharacterId?: string;
  payload: Record<string, unknown>;
}

export interface CharacterInteractionPlan {
  sceneId: string;
  characters: CharacterInteractionState[];
  beats: InteractionBeat[];
}

export function createInteractionBeat(input: Omit<InteractionBeat, "id">): InteractionBeat {
  return { ...input, id: crypto.randomUUID() };
}

export function addReaction(plan: CharacterInteractionPlan, characterId: string, atMs: number, targetCharacterId?: string): CharacterInteractionPlan {
  return {
    ...plan,
    beats: [...plan.beats, createInteractionBeat({ characterId, atMs, durationMs: 600, kind: "reaction", targetCharacterId, payload: { preserveDialogueTiming: true } })],
  };
}

export function setAttention(plan: CharacterInteractionPlan, characterId: string, targetCharacterId: string): CharacterInteractionPlan {
  return {
    ...plan,
    characters: plan.characters.map(c => c.characterId === characterId ? { ...c, attentionTarget: targetCharacterId } : c),
  };
}
