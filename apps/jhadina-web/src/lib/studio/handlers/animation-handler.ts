import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import type { CharacterInteractionPlan, InteractionBeat } from "../character-interaction-engine";

export interface AnimationCommand {
  characterId: string;
  atMs: number;
  durationMs: number;
  action: "look-at" | "reaction" | "gesture" | "move" | "speak";
  targetCharacterId?: string;
  payload: Record<string, unknown>;
}

export function interactionBeatsToAnimationCommands(plan: CharacterInteractionPlan): AnimationCommand[] {
  return plan.beats.map((beat: InteractionBeat): AnimationCommand => ({
    characterId: beat.characterId,
    atMs: beat.atMs,
    durationMs: beat.durationMs,
    action: beat.kind === "gaze" ? "look-at" : beat.kind === "dialogue" ? "speak" : beat.kind,
    targetCharacterId: beat.targetCharacterId,
    payload: beat.payload,
  }));
}

export class InteractionAnimationHandler implements StudioActionHandler {
  readonly action = "animate-interaction" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    const plan = request.parameters?.interactionPlan as CharacterInteractionPlan | undefined;
    if (!plan) {
      return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "An interaction plan is required before interaction animation can run." };
    }
    const commands = interactionBeatsToAnimationCommands(plan);
    return {
      action: this.action as never,
      status: "complete",
      outputIds: [`animation-plan:${request.projectId}:${Date.now()}`],
      qcRequired: true,
      message: `Converted ${commands.length} interaction beats into animation commands for the Studio timeline.`,
    };
  }
}
