export type AudioSource = "microphone" | "system_audio" | "remote_audio";

export interface AudioSourcePolicy {
  microphone: boolean;
  systemAudio: boolean;
  remoteAudio: boolean;
  micWarmMode: "disabled" | "on_demand" | "voice_mode" | "always";
}

export const DEFAULT_AUDIO_SOURCE_POLICY: AudioSourcePolicy = {
  microphone: true,
  systemAudio: false,
  remoteAudio: false,
  micWarmMode: "disabled",
};

export function isAudioSourceAllowed(policy: AudioSourcePolicy, source: AudioSource): boolean {
  switch (source) {
    case "microphone": return policy.microphone;
    case "system_audio": return policy.systemAudio;
    case "remote_audio": return policy.remoteAudio;
  }
}
