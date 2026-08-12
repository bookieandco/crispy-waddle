import type { StudioActionHandler, StudioActionRequest, StudioActionResult } from "../action-handlers";

type VisualAction = "character-replace" | "rig" | "animate" | "render";

abstract class BaseVisualHandler implements StudioActionHandler {
  abstract readonly action: VisualAction;
  protected abstract readonly label: string;

  async execute(request: StudioActionRequest): Promise<StudioActionResult> {
    if (request.inputIds.length === 0) {
      return { action: this.action, status: "failed", outputIds: [], qcRequired: true, message: `${this.label} needs at least one input asset.` };
    }
    return {
      action: this.action,
      status: "complete",
      outputIds: [`${this.action}:${request.projectId}:${Date.now()}`],
      qcRequired: true,
      message: `${this.label} execution plan created. Route the asset through the configured provider, then run QC before approval.`,
    };
  }
}

export class CharacterReplacementHandler extends BaseVisualHandler {
  readonly action = "character-replace" as const;
  protected readonly label = "Character replacement";
}

export class RigHandler extends BaseVisualHandler {
  readonly action = "rig" as const;
  protected readonly label = "Rigging";
}

export class AnimationHandler extends BaseVisualHandler {
  readonly action = "animate" as const;
  protected readonly label = "Animation";
}

export class RenderHandler extends BaseVisualHandler {
  readonly action = "render" as const;
  protected readonly label = "Rendering";
}
