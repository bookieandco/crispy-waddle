import type { PerceptionEvent } from "./perception-contract";

export interface ScreenFrame {
  id: string;
  capturedAt: string;
  contentRef: string;
  width: number;
  height: number;
  displayId?: string;
  windowId?: string;
}

export interface ScreenCapturePolicy {
  enabled: boolean;
  intervalMs: number;
  onDemandOnly: boolean;
  excludedDisplayIds?: string[];
  excludedWindowIds?: string[];
}

export interface ScreenSource {
  readonly id: string;
  readonly modality: "screen";
  capture(policy: ScreenCapturePolicy): Promise<ScreenFrame | null>;
}

export function frameToPerceptionEvent(
  source: ScreenSource,
  frame: ScreenFrame,
  sensitivity: PerceptionEvent["sensitivity"] = "normal",
): PerceptionEvent {
  return {
    id: frame.id,
    source: { id: source.id, modality: "screen", label: "screen" },
    occurredAt: frame.capturedAt,
    contentRef: frame.contentRef,
    sensitivity,
    retention: "ephemeral",
    confidence: 1,
    metadata: {
      width: frame.width,
      height: frame.height,
      displayId: frame.displayId,
      windowId: frame.windowId,
    },
  };
}
