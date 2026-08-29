import type { PerceptionEvent, PerceptionObservation } from "./perception-contract";

export interface VisionProvider {
  readonly id: string;
  describe(event: PerceptionEvent): Promise<PerceptionObservation>;
}

export interface ScreenVisionRequest {
  event: PerceptionEvent;
  instruction?: string;
  maxDetail?: "brief" | "standard" | "deep";
}

export interface ScreenVisionProvider extends VisionProvider {
  describeScreen(request: ScreenVisionRequest): Promise<PerceptionObservation>;
}
