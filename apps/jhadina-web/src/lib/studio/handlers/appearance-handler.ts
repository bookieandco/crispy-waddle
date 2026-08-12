import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import { createAppearancePlan, type AppearancePlan } from "../appearance-runtime";

export class AppearanceHandler implements StudioActionHandler {
  readonly action = "appearance" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    const input = request.parameters?.appearancePlan as Omit<AppearancePlan, "preserveIdentity" | "preserveContinuity"> | undefined;
    if (!input?.characterId) return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "Character appearance data is required." };
    const plan = createAppearancePlan(input);
    return { action: this.action as never, status: "complete", outputIds: [`appearance-plan:${request.projectId}:${Date.now()}`], qcRequired: true, message: `Appearance plan created for ${plan.characterId} with ${plan.garments.length} garments and identity continuity enabled.` };
  }
}
