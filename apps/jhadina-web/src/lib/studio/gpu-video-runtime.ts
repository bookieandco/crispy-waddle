export type GPUVideoOperation =
  | "color"
  | "tone"
  | "blur"
  | "sharpen"
  | "denoise"
  | "transform"
  | "chroma-key"
  | "stylize"
  | "mask-composite"
  | "thumbnail";

export interface GPUVideoRequest {
  operation: GPUVideoOperation;
  assetId: string;
  parameters: Record<string, number | string | boolean>;
  sourceTrackIds?: string[];
  output: "preview" | "artifact";
}

export interface GPUVideoResult {
  status: "queued" | "complete" | "failed";
  artifactId?: string;
  frameCount?: number;
  gpuBackend: "ios" | "macos" | "linux" | "remote";
  warnings: string[];
}

/** Provider-neutral bridge for GPUImage2 on iOS/macOS and remote GPU processing elsewhere. */
export interface GPUVideoProvider {
  readonly name: string;
  process(request: GPUVideoRequest): Promise<GPUVideoResult>;
}
