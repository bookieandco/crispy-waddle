export type AudioEditOperation = "bass_reduce" | "vocal_clean";

export interface MediaProcessRequest {
  sourcePath: string;
  outputPath?: string;
  operation: AudioEditOperation;
}

export interface MediaProcessResult {
  outputPath: string;
  operation: AudioEditOperation;
}

export interface MediaProcessorPort {
  process(request: MediaProcessRequest): Promise<MediaProcessResult>;
}
