import type { ScreenCapturePolicy, ScreenFrame } from "./screen-contract";

export interface HostScreenCaptureBridge {
  capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null>;
}

export class BrowserScreenCaptureBridge implements HostScreenCaptureBridge {
  constructor(private readonly captureDisplay: () => Promise<ScreenFrame | null>) {}

  capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null> {
    if (!policy.enabled || !policy.onDemandOnly) return Promise.resolve(null);
    return this.captureDisplay();
  }
}
