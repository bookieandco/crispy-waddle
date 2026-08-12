import type { CharacterBehaviorDNA } from "./character-dna";
import { generateBaselineBehavior, type BehaviorBeat } from "./behavior-engine";
import type { CharacterInteractionPlan } from "./character-interaction-engine";
import { interactionBeatsToAnimationCommands, type AnimationCommand } from "./handlers/animation-handler";

export interface CharacterTimelinePlan {
  characterId: string;
  behaviorBeats: BehaviorBeat[];
  animationCommands: AnimationCommand[];
}

export function buildCharacterTimeline(dna: CharacterBehaviorDNA, interaction: CharacterInteractionPlan, durationMs: number): CharacterTimelinePlan {
  const behaviorBeats = generateBaselineBehavior(dna, durationMs);
  const animationCommands = interactionBeatsToAnimationCommands(interaction)
    .filter(command => command.characterId === dna.characterId)
    .sort((a, b) => a.atMs - b.atMs);

  return { characterId: dna.characterId, behaviorBeats, animationCommands };
}

export function mergeTimelineEvents(plan: CharacterTimelinePlan): Array<BehaviorBeat | AnimationCommand> {
  return [...plan.behaviorBeats, ...plan.animationCommands].sort((a, b) => a.atMs - b.atMs);
}
