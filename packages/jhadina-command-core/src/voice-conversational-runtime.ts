import type { ConversationalCommandRuntime } from "./conversational-command-runtime";
import type { JhadinaResponse } from "./response-generation";
import { voiceCommandFromTranscript, type TranscriptResult } from "./voice-command-bridge";

export interface VoiceConversationalRuntimeRequest {
  transcription: TranscriptResult;
  occurredAt?: string;
  conversationContext?: string;
  personalityContext?: string;
}

export class VoiceConversationalRuntime {
  constructor(private readonly runtime: ConversationalCommandRuntime) {}

  run(request: VoiceConversationalRuntimeRequest): Promise<JhadinaResponse> {
    const command = voiceCommandFromTranscript(request.transcription, request.occurredAt);
    return this.runtime.run({
      command,
      conversationContext: request.conversationContext,
      personalityContext: request.personalityContext,
    });
  }
}
