import type { CapabilityRegistry } from "../../jhadina-capability-registry/src";
import type { CapabilityInvoker, CapabilityInvocation } from "./command-contract";
import { resolveCapability } from "./capability-adapter";
import type { AudioCapturePort, AudioCaptureRequest } from "./audio-capture-port";
import { toAudioObservation } from "./audio-capture-port";
import { transcribeAudioFrame, type WhisperClient } from "./whisper-adapter";

export const VOICE_TRANSCRIBE_CAPABILITY = "voice.transcribe";

export function registerVoiceTranscribeCapability(registry: CapabilityRegistry): void {
  registry.register({
    name: VOICE_TRANSCRIBE_CAPABILITY,
    description: "Capture audio and transcribe spoken language.",
    risk: "read",
    version: 1,
  });
}

export class VoiceTranscribeCapabilityInvoker implements CapabilityInvoker {
  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly capture: AudioCapturePort,
    private readonly whisper: WhisperClient,
  ) {}

  async invoke(invocation: CapabilityInvocation): Promise<unknown> {
    resolveCapability(this.registry, invocation);
    if (invocation.capability !== VOICE_TRANSCRIBE_CAPABILITY) {
      throw new Error(`Unsupported voice capability: ${invocation.capability}`);
    }

    const args = invocation.arguments;
    const request = args.request && typeof args.request === "object"
      ? args.request as AudioCaptureRequest
      : args as AudioCaptureRequest;
    const observation = toAudioObservation(await this.capture.capture(request));
    const transcription = await transcribeAudioFrame(observation.frame, this.whisper, {
      model: typeof args.model === "string" ? args.model : undefined,
      language: typeof args.language === "string" ? args.language : undefined,
    });

    return { observation, transcription };
  }
}
