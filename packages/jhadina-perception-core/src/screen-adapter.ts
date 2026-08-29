import type { ScreenCapturePolicy, ScreenFrame, ScreenSource } from "./screen-contract";

export interface HostScreenCapture {
  capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null>;
}

/** Adapts an OS/browser capture implementation without coupling perception-core to a platform API. */
export class HostScreenSource implements ScreenSource {
  readonly modality = "screen" as const;

  constructor(
    readonly id: string,
    private readonly capturePort: HostScreenCapture,
  ) {}

  capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null> {
    if (!policy.enabled) return Promise.resolve(null);
    return this.capturePort.capture(policy);
  }
}
