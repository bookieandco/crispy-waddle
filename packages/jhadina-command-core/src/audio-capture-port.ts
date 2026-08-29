export type AudioMediaType = "audio/wav" | "audio/mpeg" | "audio/mp4" | "audio/webm";

export interface AudioFrame {
  capturedAt: string;
  durationMs: number;
  sampleRate: number;
  channels: number;
  mediaType: AudioMediaType;
  audio: string;
}

export interface AudioCaptureRequest {
  durationMs?: number;
  device?: string;
  sampleRate?: number;
  channels?: number;
}

export interface AudioCapturePort {
  capture(request?: AudioCaptureRequest): Promise<AudioFrame>;
}

export interface AudioObservation {
  kind: "audio";
  frame: AudioFrame;
}

export function toAudioObservation(frame: AudioFrame): AudioObservation {
  return { kind: "audio", frame };
}
