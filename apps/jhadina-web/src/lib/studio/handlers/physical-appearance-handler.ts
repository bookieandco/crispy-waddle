import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";
import { buildPhysicsBindings, checkShotContinuity, type PhysicsAsset, type ShotAppearanceState } from "../physical-appearance-runtime";

export class PhysicalAppearanceHandler implements StudioActionHandler {
  readonly action = "physical-appearance" as const;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    const assets = (request.parameters?.physicsAssets as PhysicsAsset[]) ?? [];
    const current = request.parameters?.currentShot as ShotAppearanceState | undefined;
    const previous = request.parameters?.previousShot as ShotAppearanceState | undefined;
    if (!current) return { action: this.action as never, status: "failed", outputIds: [], qcRequired: true, message: "Current shot appearance state is required." };
    const continuity = previous ? checkShotContinuity(previous, current) : [];
    const bindings = buildPhysicsBindings(assets);
    return {
      action: this.action as never,
      status: continuity.some(i => i.severity === "error") ? "failed" : "complete",
      outputIds: [`appearance-physics:${request.projectId}:${Date.now()}`],
      qcRequired: true,
      message: `Prepared ${Object.keys(bindings).length} physics bindings and found ${continuity.length} continuity issues.`,
    };
  }
}
