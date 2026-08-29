import type { CapabilityDefinition } from "../../jhadina-capability-registry/src";

export const VOICE_TRANSCRIBE_CAPABILITY: CapabilityDefinition = Object.freeze({
  name: "voice.transcribe",
  description: "Transcribe permitted audio input into text for Jhadina reasoning.",
  risk: "read",
  version: 1,
});

export const AUDIO_EDIT_CAPABILITY: CapabilityDefinition = Object.freeze({
  name: "audio.edit",
  description: "Apply an explicitly requested edit to permitted media audio.",
  risk: "write",
  version: 1,
});
