import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import { addReaction, setAttention, type CharacterInteractionPlan } from "../character-interaction-engine";

export class CharacterInteractionHandler implements StudioActionHandler {
  readonly action = "character-interaction" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    if (!request.inputIds.length) {
      return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "Character interaction needs a scene or character input." };
    }

    let plan: CharacterInteractionPlan = {
      sceneId: request.projectId,
      characters: (request.parameters?.characters as CharacterInteractionPlan["characters"]) ?? [],
      beats: [],
    };

    const characters = plan.characters;
    if (characters.length >= 2) {
      plan = setAttention(plan, characters[0].characterId, characters[1].characterId);
      plan = setAttention(plan, characters[1].characterId, characters[0].characterId);
      plan = addReaction(plan, characters[1].characterId, Number(request.parameters?.reactionAtMs ?? 0), characters[0].characterId);
    }

    return {
      action: this.action as never,
      status: "complete",
      outputIds: [`interaction-plan:${request.projectId}:${Date.now()}`],
      qcRequired: true,
      message: `Interaction plan created with ${plan.characters.length} characters and ${plan.beats.length} reaction beats.`,
    };
  }
}
