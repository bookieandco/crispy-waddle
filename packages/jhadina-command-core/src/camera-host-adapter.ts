import type {
  CameraCapturePort,
  CameraCaptureRequest,
  CameraFrame,
} from "./camera-capture-port";

export interface CameraHostClient {
  capture(request: CameraCaptureRequest): Promise<CameraFrame>;
}

/**
 * Host-neutral bridge for native camera implementations such as iOS/Mijick Camera.
 * Native UI/AVFoundation code stays outside Jhadina Core.
 */
export class CameraHostAdapter implements CameraCapturePort {
  constructor(private readonly client: CameraHostClient) {}

  capture(request: CameraCaptureRequest = {}): Promise<CameraFrame> {
    return this.client.capture(request);
  }
}
