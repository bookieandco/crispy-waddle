import type { CharacterBehaviorDNA } from "./character-dna";

export type BehaviorKind = "breath" | "walk" | "talk" | "eat" | "idle" | "gesture" | "look" | "react";

export interface BehaviorBeat {
  characterId: string;
  kind: BehaviorKind;
  atMs: number;
  durationMs: number;
  intensity: number;
  payload?: Record<string, unknown>;
}

export function generateBaselineBehavior(dna: CharacterBehaviorDNA, durationMs: number): BehaviorBeat[] {
  const beats: BehaviorBeat[] = [];
  if (dna.breathing.enabled) {
    const interval = 60000 / Math.max(6, dna.breathing.ratePerMinute);
    for (let t = 0; t < durationMs; t += interval) beats.push({ characterId: dna.characterId, kind: "breath", atMs: Math.round(t), durationMs: Math.round(interval * 0.55), intensity: 1 });
  }
  return beats;
}

export function addBehaviorBeat(beats: BehaviorBeat[], dna: CharacterBehaviorDNA, kind: BehaviorKind, atMs: number, durationMs: number, intensity = 1, payload?: Record<string, unknown>): BehaviorBeat[] {
  return [...beats, { characterId: dna.characterId, kind, atMs, durationMs, intensity, payload }].sort((a, b) => a.atMs - b.atMs);
}
