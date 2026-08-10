import type { GPUVideoProvider, GPUVideoRequest, GPUVideoResult } from "./gpu-video-runtime";

/**
 * Adapter boundary for the native Swift/iOS/macOS GPUImage2 runtime.
 * GPUImage2 is BSD-licensed and provides GPU-accelerated image/video pipelines.
 * The actual Swift implementation lives in the native Studio target.
 */
export class GPUImage2Provider implements GPUVideoProvider {
  readonly name = "gpuimage2";

  async process(request: GPUVideoRequest): Promise<GPUVideoResult> {
    return {
      status: "queued",
      gpuBackend: "ios",
      warnings: [`Native GPUImage2 execution is required for operation '${request.operation}'.`],
    };
  }
}
