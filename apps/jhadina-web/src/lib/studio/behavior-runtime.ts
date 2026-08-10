import type { CharacterBehaviorDNA } from "./character-dna";
import type { BehaviorBeat } from "./behavior-engine";
import type { AnimationCommand } from "./handlers/animation-handler";

export interface RigControl {
  characterId: string;
  control: string;
  atMs: number;
  durationMs: number;
  value: number | string;
  targetCharacterId?: string;
}

export interface EnvironmentConstraint {
  objectId: string;
  kind: "collision" | "surface" | "occlusion" | "keep-out";
  bounds: { x: number; y: number; z: number; width: number; height: number; depth: number };
}

export interface RuntimePlan {
  rigControls: RigControl[];
  constraints: EnvironmentConstraint[];
  warnings: string[];
}

export function behaviorBeatToRigControls(beat: BehaviorBeat, dna: CharacterBehaviorDNA): RigControl[] {
  const controls: RigControl[] = [];
  switch (beat.kind) {
    case "breath": controls.push({ characterId: beat.characterId, control: "chest_breath", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.intensity }); break;
    case "walk": controls.push({ characterId: beat.characterId, control: "gait_pace", atMs: beat.atMs, durationMs: beat.durationMs, value: dna.movement.pace * beat.intensity }); break;
    case "talk": controls.push({ characterId: beat.characterId, control: "jaw_speech", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.intensity }); break;
    case "eat": controls.push({ characterId: beat.characterId, control: "eat_cycle", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.intensity }); break;
    case "gesture": controls.push({ characterId: beat.characterId, control: "gesture_intensity", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.intensity }); break;
    case "look": controls.push({ characterId: beat.characterId, control: "eye_saccade", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.payload?.targetX as number ?? 0 }); break;
    case "react": controls.push({ characterId: beat.characterId, control: "facial_reaction", atMs: beat.atMs, durationMs: beat.durationMs, value: beat.payload?.expression as string ?? "neutral" }); break;
  }
  return controls;
}

export function animationCommandToRigControl(command: AnimationCommand): RigControl {
  const controlByAction: Record<AnimationCommand["action"], string> = {
    "look-at": "head_gaze",
    reaction: "facial_reaction",
    gesture: "hand_gesture",
    move: "root_motion",
    speak: "jaw_speech",
  };
  return { characterId: command.characterId, control: controlByAction[command.action], atMs: command.atMs, durationMs: command.durationMs, value: command.payload.expression as string ?? command.payload.intensity as number ?? 1, targetCharacterId: command.targetCharacterId };
}

export function buildRuntimePlan(beats: BehaviorBeat[], commands: AnimationCommand[], constraints: EnvironmentConstraint[] = []): RuntimePlan {
  const rigControls = [...beats.flatMap(b => behaviorBeatToRigControls(b, { characterId: b.characterId, archetype: "human", traits: [], breathing: { enabled: true, ratePerMinute: 14, variability: .18 }, movement: { gait: "natural", pace: 1, idleVariation: .2 }, speech: { cadence: 1, pauseVariation: .2, overlapTolerance: .08 }, eating: { enabled: true, tempo: 1, biteVariation: .2 }, social: { eyeContact: .7, personalSpace: .65, gestureFrequency: .55, reactionDelayMs: 350 }, continuity: { preserveAcrossScenes: true, lastUpdatedAt: new Date().toISOString() } })), ...commands.map(animationCommandToRigControl)];
  return { rigControls: rigControls.sort((a, b) => a.atMs - b.atMs), constraints, warnings: [] };
}
