import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { ScreenCapturePort } from "./screen-capture-port";
import { ScreenPerceptionCapabilityInvoker } from "./screen-perception-capability";

export const LOOK_AT_SCREEN_CAPABILITY = "perception.look_at_screen";
export const LOOK_AT_SCREEN_VERSION = "1.0.0";

export function registerScreenVisionCapability(
  registry: CapabilityRegistry,
  capture: ScreenCapturePort,
): void {
  registry.register({
    id: LOOK_AT_SCREEN_CAPABILITY,
    version: LOOK_AT_SCREEN_VERSION,
    risk: "read",
    invoke: new ScreenPerceptionCapabilityInvoker(capture),
  });
}
