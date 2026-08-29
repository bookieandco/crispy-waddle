import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { CapabilityInvokerRegistry } from "./capability-invoker-registry";
import type { AudioCapturePort } from "./audio-capture-port";
import type { WhisperClient } from "./whisper-adapter";
import type { MediaProcessorPort } from "./media-processor-port";
import { registerAudioCapabilities } from "./audio-capability-composition";

export interface AudioCapabilityComposition {
  registry: CapabilityRegistry;
  invokers: CapabilityInvokerRegistry;
}

export function composeAudioCapabilities(
  registry: CapabilityRegistry,
  capture: AudioCapturePort,
  whisper: WhisperClient,
  processor: MediaProcessorPort,
): AudioCapabilityComposition {
  const invokers = new CapabilityInvokerRegistry();
  registerAudioCapabilities(registry, invokers, capture, whisper, processor);
  return { registry, invokers };
}
