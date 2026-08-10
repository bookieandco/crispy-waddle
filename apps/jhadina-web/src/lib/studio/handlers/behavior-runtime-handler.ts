import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import type { CharacterBehaviorDNA } from "../character-dna";
import type { BehaviorBeat } from "../behavior-engine";
import type { AnimationCommand } from "./animation-handler";
import { buildRuntimePlan } from "../behavior-runtime";

export class BehaviorRuntimeHandler implements StudioActionHandler {
  readonly action = "behavior-runtime" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    const dna = request.parameters?.characterDNA as CharacterBehaviorDNA | undefined;
    const beats = (request.parameters?.behaviorBeats as BehaviorBeat[]) ?? [];
    const commands = (request.parameters?.animationCommands as AnimationCommand[]) ?? [];
    if (!dna) return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "Character DNA is required before the behavior runtime can execute." };
    const plan = buildRuntimePlan(beats, commands, (request.parameters?.constraints as never[]) ?? []);
    return { action: this.action as never, status: "complete", outputIds: [`runtime-plan:${request.projectId}:${Date.now()}`], qcRequired: true, message: `Generated ${plan.rigControls.length} rig controls with ${plan.constraints.length} environment constraints.` };
  }
}
