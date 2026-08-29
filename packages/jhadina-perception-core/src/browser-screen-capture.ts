import type { ScreenCapturePolicy, ScreenFrame } from "./screen-contract";
import type { HostScreenCaptureBridge } from "./host-screen-capture";

export interface DisplayCaptureSource {
  capture(): Promise<{ contentRef: string; width: number; height: number; displayId?: string; windowId?: string }>;
}

/** Host-side implementation point. The host owns permission prompts and actual capture APIs. */
export class BrowserDisplayCapture implements HostScreenCaptureBridge {
  constructor(private readonly source: DisplayCaptureSource) {}

  async capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null> {
    if (!policy.enabled || !policy.onDemandOnly) return null;
    const captured = await this.source.capture();
    if (captured.displayId && policy.excludedDisplayIds?.includes(captured.displayId)) return null;
    if (captured.windowId && policy.excludedWindowIds?.includes(captured.windowId)) return null;
    return {
      id: crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      ...captured,
    };
  }
}
