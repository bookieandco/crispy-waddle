import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvoker, CapabilityInvocation } from "./command-contract";
import { resolveCapability } from "./capability-adapter";
import type { ScreenCapturePort } from "./screen-capture-port";
import { toScreenObservation } from "./screen-capture-port";

export const SCREEN_LOOK_CAPABILITY = "perception.look_at_screen";

export function registerScreenLookCapability(registry: CapabilityRegistry): void {
  registry.register({
    name: SCREEN_LOOK_CAPABILITY,
    description: "Capture the requested host screen for visual perception.",
    risk: "read",
    version: 1,
  });
}

export class ScreenPerceptionCapabilityInvoker implements CapabilityInvoker {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly capture: ScreenCapturePort,
  ) {}

  async invoke(invocation: CapabilityInvocation): Promise<unknown> {
    resolveCapability(this.registry, invocation);
    if (invocation.capability !== SCREEN_LOOK_CAPABILITY) {
      throw new Error(`Unsupported perception capability: ${invocation.capability}`);
    }

    const args = invocation.arguments;
    const request = args.request && typeof args.request === "object"
      ? args.request as { displayId?: string; windowId?: string }
      : args as { displayId?: string; windowId?: string };

    return toScreenObservation(await this.capture.capture(request));
  }
}
