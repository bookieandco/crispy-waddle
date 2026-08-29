import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { CapabilityInvokerRegistry } from "./capability-invoker-registry";
import type { AudioCapturePort } from "./audio-capture-port";
import type { WhisperClient } from "./whisper-adapter";
import type { MediaProcessorPort } from "./media-processor-port";
import { registerAudioCapabilities } from "./audio-capability-composition";
import { PolicyEnforcedAudioCapture } from "./policy-enforced-audio-capture";
import { DEFAULT_AUDIO_SOURCE_POLICY, type AudioSourcePolicy } from "./audio-source-policy";

export interface AudioCapabilityComposition {
  registry: CapabilityRegistry;
  invokers: CapabilityInvokerRegistry;
}

export function composeAudioCapabilities(
  registry: CapabilityRegistry,
  capture: AudioCapturePort,
  whisper: WhisperClient,
  processor: MediaProcessorPort,
  policy: AudioSourcePolicy = DEFAULT_AUDIO_SOURCE_POLICY,
): AudioCapabilityComposition {
  const invokers = new CapabilityInvokerRegistry();
  const guardedCapture = new PolicyEnforcedAudioCapture(capture, policy);
  registerAudioCapabilities(registry, invokers, guardedCapture, whisper, processor);
  return { registry, invokers };
}
