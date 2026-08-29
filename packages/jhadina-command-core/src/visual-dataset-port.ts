import type { VisionObservation } from "./vision-input-adapter";

export interface VisualSample {
  id: string;
  capturedAt: string;
  source: "screen" | "camera";
  mediaType: string;
  image: string;
  metadata?: Record<string, string>;
}

export interface VisualDatasetPort {
  submit(sample: VisualSample): Promise<{ sampleId: string }>;
}

export function observationToVisualSample(observation: VisionObservation, id: string): VisualSample {
  return {
    id,
    capturedAt: observation.frame.capturedAt,
    source: observation.kind,
    mediaType: observation.frame.mediaType,
    image: observation.frame.image,
  };
}
