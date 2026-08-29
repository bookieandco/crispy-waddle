import type { ActionHandler, ActionRequest } from "../../jhadina-action-core/src";
import { lookAtScreen, type LookAtScreenResult } from "./on-demand-screen";
import type { EventBus } from "../../jhadina-event-bus/src";
import { PerceptionRouter } from "./perception-router";
import { SalienceEngine } from "./salience-engine";
import type { ScreenCapturePolicy, ScreenSource } from "./screen-contract";

export interface LookAtScreenAction {
  policy: ScreenCapturePolicy;
}

export class LookAtScreenActionHandler implements ActionHandler<LookAtScreenAction, LookAtScreenResult> {
  readonly type = "perception.look_at_screen";

  constructor(
    private readonly source: ScreenSource,
    private readonly router: PerceptionRouter,
    private readonly salience: SalienceEngine,
    private readonly eventBus: EventBus,
  ) {}

  supports(type: string): boolean {
    return type === this.type;
  }

  execute(action: LookAtScreenAction, request: ActionRequest<LookAtScreenAction>): Promise<LookAtScreenResult> {
    return lookAtScreen(
      this.source,
      this.router,
      this.salience,
      this.eventBus,
      action.policy,
      request.id,
    );
  }
}
