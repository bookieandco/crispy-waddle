import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { CapabilityInvokerRegistry } from "./capability-invoker-registry";
import { CameraPerceptionCapabilityInvoker, registerCameraLookCapability } from "./camera-perception-capability";
import type { CameraCapturePort } from "./camera-capture-port";
import { MacOSScreenCaptureAdapter } from "./screen-capture-host-adapter";
import { ScreenPerceptionCapabilityInvoker, registerScreenLookCapability } from "./screen-perception-capability";
import type { ScreenCapturePort } from "./screen-capture-port";

export interface EyesCapabilityComposition {
  invoker: CapabilityInvokerRegistry;
  screen: ScreenPerceptionCapabilityInvoker;
  camera?: CameraPerceptionCapabilityInvoker;
}

export function composeEyesCapabilities(
  registry: CapabilityRegistry,
  options: { screen?: ScreenCapturePort; camera?: CameraCapturePort } = {},
): EyesCapabilityComposition {
  const screen = new ScreenPerceptionCapabilityInvoker(
    registry,
    options.screen ?? new MacOSScreenCaptureAdapter(),
  );
  registerScreenLookCapability(registry);

  const invoker = new CapabilityInvokerRegistry();
  invoker.register("perception.look_at_screen", screen);

  let camera: CameraPerceptionCapabilityInvoker | undefined;
  if (options.camera) {
    registerCameraLookCapability(registry);
    camera = new CameraPerceptionCapabilityInvoker(registry, options.camera);
    invoker.register("perception.look_at_camera", camera);
  }

  return { invoker, screen, camera };
}
