import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvoker, CapabilityInvocation } from "./command-contract";
import { resolveCapability } from "./capability-adapter";
import type { CameraCapturePort, CameraCaptureRequest } from "./camera-capture-port";
import { toCameraObservation } from "./camera-capture-port";

export const CAMERA_LOOK_CAPABILITY = "perception.look_at_camera";

export function registerCameraLookCapability(registry: CapabilityRegistry): void {
  registry.register({
    name: CAMERA_LOOK_CAPABILITY,
    description: "Capture a camera frame for visual perception.",
    risk: "read",
    version: 1,
  });
}

export class CameraPerceptionCapabilityInvoker implements CapabilityInvoker {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly capture: CameraCapturePort,
  ) {}

  async invoke(invocation: CapabilityInvocation): Promise<unknown> {
    resolveCapability(this.registry, invocation);
    if (invocation.capability !== CAMERA_LOOK_CAPABILITY) {
      throw new Error(`Unsupported perception capability: ${invocation.capability}`);
    }

    const args = invocation.arguments;
    const request = args.request && typeof args.request === "object"
      ? args.request as CameraCaptureRequest
      : args as CameraCaptureRequest;

    return toCameraObservation(await this.capture.capture(request));
  }
}
