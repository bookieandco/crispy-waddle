export type TranscriptWord = {
  text: string;
  startSeconds: number;
  endSeconds: number;
  confidence?: number;
  speakerId?: string;
};

export type TranscriptSegment = {
  id: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  speakerId?: string;
  words: TranscriptWord[];
};

export type Transcript = {
  id: string;
  assetId: string;
  language?: string;
  durationSeconds?: number;
  segments: TranscriptSegment[];
  provider: string;
  model?: string;
  createdAt: string;
};

export type TranscriptionProvider = {
  id: string;
  transcribe(input: { assetId: string; mediaUri: string; language?: string }): Promise<Transcript>;
};

export function transcriptWords(transcript: Transcript): TranscriptWord[] {
  return transcript.segments.flatMap(segment => segment.words);
}

export function findTranscriptRange(transcript: Transcript, startSeconds: number, endSeconds: number): TranscriptSegment[] {
  return transcript.segments.filter(segment => segment.endSeconds > startSeconds && segment.startSeconds < endSeconds);
}

export function transcriptText(transcript: Transcript, startSeconds?: number, endSeconds?: number): string {
  const segments = startSeconds == null || endSeconds == null ? transcript.segments : findTranscriptRange(transcript, startSeconds, endSeconds);
  return segments.map(segment => segment.text.trim()).filter(Boolean).join(' ');
}

export function wordsMatching(transcript: Transcript, pattern: RegExp): TranscriptWord[] {
  return transcriptWords(transcript).filter(word => pattern.test(word.text));
}
