import type { ActionExecutor } from "../../jhadina-action-core/src";
import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { LookCommandPlanner } from "../../jhadina-command-core/src";
import { LookAtScreenActionHandler } from "../../jhadina-perception-core/src";
import type { EventBus } from "../../jhadina-event-bus/src";
import { PerceptionRouter } from "../../jhadina-perception-core/src";
import { SalienceEngine } from "../../jhadina-perception-core/src";
import type { ScreenSource } from "../../jhadina-perception-core/src";
import type { VisionProvider } from "../../jhadina-perception-core/src";
import { registerLookCapability } from "../../jhadina-perception-core/src";
import { HostScreenSource } from "../../jhadina-perception-core/src";
import type { HostScreenCapture } from "../../jhadina-perception-core/src";
import { GatewayCommandRuntime } from "./command-runtime";

export interface LookRuntimeDependencies {
  capabilities: CapabilityRegistry;
  actions: ActionExecutor;
  capture: HostScreenCapture;
  vision: VisionProvider;
  router: PerceptionRouter;
  salience: SalienceEngine;
  eventBus: EventBus;
  userId: string;
}

export function composeLookRuntime(deps: LookRuntimeDependencies): GatewayCommandRuntime {
  const source: ScreenSource = new HostScreenSource("host-screen", deps.capture);
  const handler = new LookAtScreenActionHandler(source, deps.router, deps.salience, deps.eventBus);
  registerLookCapability(deps.capabilities, handler);
  deps.actions.register(handler);

  return new GatewayCommandRuntime(
    new LookCommandPlanner(),
    deps.capabilities,
    deps.actions,
    deps.userId,
  );
}
