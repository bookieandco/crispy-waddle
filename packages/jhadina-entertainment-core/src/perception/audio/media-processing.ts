export type AudioEditOperation =
  | { kind: "bass"; gainDb: number; frequencyHz?: number }
  | { kind: "noise_reduction"; amount: number }
  | { kind: "vocal_clean"; strength: number }
  | { kind: "normalize"; targetLufs: number }
  | { kind: "high_pass"; frequencyHz: number }
  | { kind: "low_pass"; frequencyHz: number };

export interface MediaProcessRequest {
  sourceUri: string;
  outputUri: string;
  operations: AudioEditOperation[];
  preserveOriginal: boolean;
}

export interface MediaProcessResult {
  outputUri: string;
  durationMs?: number;
  warnings: string[];
}

/** External media-processing boundary. Frame/FFmpeg can implement this port. */
export interface MediaProcessor {
  process(request: MediaProcessRequest): Promise<MediaProcessResult>;
}
