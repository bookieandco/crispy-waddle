export type PerceptionModality = "screen" | "camera" | "audio" | "image" | "video" | "document" | "url";

export type PerceptionSensitivity = "normal" | "sensitive" | "private";

export type PerceptionRetention = "ephemeral" | "session" | "experience-candidate";

export interface PerceptionSource {
  id: string;
  modality: PerceptionModality;
  label?: string;
}

export interface PerceptionEvent {
  id: string;
  source: PerceptionSource;
  occurredAt: string;
  contentRef: string;
  sensitivity: PerceptionSensitivity;
  retention: PerceptionRetention;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface PerceptionObservation {
  event: PerceptionEvent;
  summary?: string;
  entities?: string[];
  changes?: string[];
  salience?: number;
}

export interface PerceptionProvider {
  readonly id: string;
  supports(modality: PerceptionModality): boolean;
  observe(event: PerceptionEvent): Promise<PerceptionObservation>;
}

export interface PerceptionPrivacyPort {
  isAllowed(event: PerceptionEvent): boolean;
}

export interface PerceptionSink {
  publish(observation: PerceptionObservation): Promise<void>;
}
