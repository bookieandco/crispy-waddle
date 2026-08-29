import type { LLMContentPart } from "../../jhadina-llm-core/src/multimodal-contract";
import type { CameraObservation } from "./camera-capture-port";
import type { ScreenObservation } from "./screen-capture-port";

export type VisionObservation = ScreenObservation | CameraObservation;

export interface VisionInput {
  prompt: string;
  content: LLMContentPart[];
}

export function toVisionInput(observation: VisionObservation, prompt: string): VisionInput {
  const frame = observation.frame;
  return {
    prompt,
    content: [
      { type: "text", text: prompt },
      { type: "image_url", url: `data:${frame.mediaType};base64,${frame.image}`, mediaType: frame.mediaType },
    ],
  };
}
