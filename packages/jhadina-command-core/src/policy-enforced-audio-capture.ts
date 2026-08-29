import type { AudioCapturePort, AudioCaptureRequest, AudioFrame } from "./audio-capture-port";
import {
  DEFAULT_AUDIO_SOURCE_POLICY,
  isAudioSourceAllowed,
  type AudioSource,
  type AudioSourcePolicy,
} from "./audio-source-policy";

export interface PolicyEnforcedAudioCaptureRequest extends AudioCaptureRequest {
  source?: AudioSource;
}

/** Mandatory policy gate immediately before host audio capture. */
export class PolicyEnforcedAudioCapture implements AudioCapturePort {
  constructor(
    private readonly delegate: AudioCapturePort,
    private readonly policy: AudioSourcePolicy = DEFAULT_AUDIO_SOURCE_POLICY,
  ) {}

  capture(request: PolicyEnforcedAudioCaptureRequest = {}): Promise<AudioFrame> {
    const source = request.source ?? "microphone";
    if (!isAudioSourceAllowed(this.policy, source)) {
      throw new Error(`Audio source denied by policy: ${source}`);
    }

    const { source: _source, ...captureRequest } = request;
    return this.delegate.capture(captureRequest);
  }
}
