export interface TranscriptionSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  segments: TranscriptionSegment[];
}

/** Host/model boundary for speech recognition. Whisper can implement this port. */
export interface SpeechTranscriber {
  transcribe(input: {
    sourceUri: string;
    language?: string;
    translateToEnglish?: boolean;
  }): Promise<TranscriptionResult>;
}
