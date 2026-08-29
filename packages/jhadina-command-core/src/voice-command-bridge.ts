import type { JhadinaCommand } from "./command-contract";

export interface TranscriptResult {
  text: string;
}

export interface VoiceCommandFactory {
  fromTranscript(transcription: TranscriptResult, occurredAt?: string): JhadinaCommand;
}

export function voiceCommandFromTranscript(
  transcription: TranscriptResult,
  occurredAt = new Date().toISOString(),
): JhadinaCommand {
  const utterance = transcription.text.trim();
  if (!utterance) throw new Error("Cannot create a voice command from an empty transcript");

  return {
    id: crypto.randomUUID(),
    source: "voice",
    utterance,
    occurredAt,
  };
}

export const defaultVoiceCommandFactory: VoiceCommandFactory = {
  fromTranscript: voiceCommandFromTranscript,
};
