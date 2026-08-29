import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { registerScreenLookCapability, ScreenPerceptionCapabilityInvoker } from "./screen-perception-capability";
import type { ScreenCapturePort } from "./screen-capture-port";

export const LOOK_AT_SCREEN_CAPABILITY = "perception.look_at_screen";
export const LOOK_AT_SCREEN_VERSION = 1;

export function registerScreenVisionCapability(
  registry: CapabilityRegistry,
  capture: ScreenCapturePort,
): ScreenPerceptionCapabilityInvoker {
  registerScreenLookCapability(registry);
  return new ScreenPerceptionCapabilityInvoker(registry, capture);
}
