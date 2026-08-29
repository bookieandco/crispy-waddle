export interface ScreenFrame {
  capturedAt: string;
  width: number;
  height: number;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  image: string;
}

export interface ScreenCaptureRequest {
  displayId?: string;
  windowId?: string;
}

export interface ScreenCapturePort {
  capture(request?: ScreenCaptureRequest): Promise<ScreenFrame>;
}

export interface ScreenObservation {
  kind: "screen";
  frame: ScreenFrame;
}

export function toScreenObservation(frame: ScreenFrame): ScreenObservation {
  return { kind: "screen", frame };
}
