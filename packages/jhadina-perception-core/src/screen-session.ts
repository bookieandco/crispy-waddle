import type { ScreenCapturePolicy, ScreenFrame, ScreenSource } from "./screen-contract";
import type { PerceptionPrivacyPort } from "./perception-contract";

export type ScreenSessionState = "stopped" | "running" | "paused" | "private";

export class ScreenPerceptionSession {
  private state: ScreenSessionState = "stopped";

  constructor(
    private readonly source: ScreenSource,
    private readonly privacy: PerceptionPrivacyPort,
  ) {}

  getState(): ScreenSessionState {
    return this.state;
  }

  start(): void {
    this.state = "running";
  }

  pause(): void {
    this.state = "paused";
  }

  enterPrivateMode(): void {
    this.state = "private";
  }

  stop(): void {
    this.state = "stopped";
  }

  async capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null> {
    if (this.state !== "running") return null;
    if (!policy.enabled || policy.onDemandOnly) return null;

    const frame = await this.source.capture(policy);
    if (!frame) return null;

    const event = {
      id: frame.id,
      source: { id: this.source.id, modality: "screen" as const },
      occurredAt: frame.capturedAt,
      contentRef: frame.contentRef,
      sensitivity: "normal" as const,
      retention: "ephemeral" as const,
      confidence: 1,
    };

    return this.privacy.isAllowed(event) ? frame : null;
  }
}
