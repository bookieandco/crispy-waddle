export interface CameraFrame {
  capturedAt: string;
  width: number;
  height: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  image: string;
  cameraId?: string;
}

export interface CameraCaptureRequest {
  cameraId?: string;
  width?: number;
  height?: number;
  facing?: "front" | "back" | "external";
}

export interface CameraCapturePort {
  capture(request?: CameraCaptureRequest): Promise<CameraFrame>;
}

export interface CameraObservation {
  kind: "camera";
  frame: CameraFrame;
}

export function toCameraObservation(frame: CameraFrame): CameraObservation {
  return { kind: "camera", frame };
}
