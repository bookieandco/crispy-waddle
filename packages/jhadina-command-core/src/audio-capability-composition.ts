import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import { CapabilityInvokerRegistry } from "./capability-invoker-registry";
import { registerVoiceTranscribeCapability, VoiceTranscribeCapabilityInvoker } from "./voice-transcribe-capability";
import { registerAudioEditCapability, AudioEditCapabilityInvoker } from "./audio-edit-capability";
import type { AudioCapturePort } from "./audio-capture-port";
import type { WhisperClient } from "./whisper-adapter";
import type { MediaProcessorPort } from "./media-processor-port";

export function registerAudioCapabilities(
  registry: CapabilityRegistry,
  invokers: CapabilityInvokerRegistry,
  capture: AudioCapturePort,
  whisper: WhisperClient,
  processor: MediaProcessorPort,
): void {
  registerVoiceTranscribeCapability(registry);
  registerAudioEditCapability(registry);
  invokers.register(
    "voice.transcribe",
    new VoiceTranscribeCapabilityInvoker(registry, capture, whisper),
  );
  invokers.register(
    "audio.edit",
    new AudioEditCapabilityInvoker(registry, processor),
  );
}
