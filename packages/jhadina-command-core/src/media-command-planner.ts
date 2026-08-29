import type { CommandPlan, CommandPlanner, JhadinaCommand } from "./command-contract";

const VOICE_RE = /^(?:jhadina[, ]*)?(?:listen|transcribe|hear)\b/i;
const BASS_RE = /\b(?:take|turn|pull|lower|reduce)\s+(?:some\s+)?bass\s+out\b/i;
const VOCAL_RE = /\b(?:clean|cleaner|clean up)\s+(?:these\s+)?vocals?\b/i;

export class MediaCommandPlanner implements CommandPlanner {
  async plan(command: JhadinaCommand): Promise<CommandPlan> {
    const text = command.utterance.trim();

    if (BASS_RE.test(text)) {
      return {
        disposition: "execute",
        rationale: "Detected a request to reduce bass in the current media context.",
        invocation: {
          capability: "audio.edit",
          version: 1,
          risk: "write",
          arguments: { operation: "bass_reduce", source: "current_media" },
        },
      };
    }

    if (VOCAL_RE.test(text)) {
      return {
        disposition: "execute",
        rationale: "Detected a request to clean vocals in the current media context.",
        invocation: {
          capability: "audio.edit",
          version: 1,
          risk: "write",
          arguments: { operation: "vocal_clean", source: "current_media" },
        },
      };
    }

    if (VOICE_RE.test(text)) {
      return {
        disposition: "execute",
        rationale: "Detected an explicit speech transcription request.",
        invocation: {
          capability: "voice.transcribe",
          version: 1,
          risk: "read",
          arguments: { source: "current_audio" },
        },
      };
    }

    return { disposition: "answer", rationale: "No media command matched." };
  }
}
