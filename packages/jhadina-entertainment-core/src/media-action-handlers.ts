import type { ActionHandler, ActionRequest } from "../../jhadina-action-core/src";

export interface SpeechTranscriber {
  transcribe(source: string): Promise<{
    text: string;
    language?: string;
    segments?: Array<{ startMs: number; endMs: number; text: string }>;
    confidence?: number;
  }>;
}

export interface MediaProcessor {
  edit(request: {
    source: string;
    operation: "bass_reduce" | "vocal_clean";
    amount?: number;
  }): Promise<{ outputRef: string; summary: string }>;
}

export class VoiceTranscribeActionHandler implements ActionHandler<{ source?: string }, unknown> {
  readonly type = "voice.transcribe";
  constructor(private readonly transcriber: SpeechTranscriber) {}
  supports(type: string): boolean { return type === this.type; }
  async execute(action: { source?: string }, _request: ActionRequest<{ source?: string }>) {
    return this.transcriber.transcribe(action.source ?? "current_audio");
  }
}

export class AudioEditActionHandler implements ActionHandler<{ source?: string; operation?: "bass_reduce" | "vocal_clean"; amount?: number }, unknown> {
  readonly type = "audio.edit";
  constructor(private readonly processor: MediaProcessor) {}
  supports(type: string): boolean { return type === this.type; }
  async execute(action: { source?: string; operation?: "bass_reduce" | "vocal_clean"; amount?: number }, _request: ActionRequest<typeof action>) {
    if (!action.operation) throw new Error("audio.edit requires an operation");
    return this.processor.edit({
      source: action.source ?? "current_media",
      operation: action.operation,
      amount: action.amount,
    });
  }
}
