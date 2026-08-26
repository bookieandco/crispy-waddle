import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResult } from './transcription-provider.js';
import type { TranscriptSegment, TranscriptWord } from './transcript-audio-bridge.js';

export type WhisperCppProviderOptions = {
  executablePath: string;
  modelPath: string;
  spawn: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

/** Adapter boundary for a local whisper.cpp binary; DirectorOS owns no whisper-specific editor logic. */
export class WhisperCppTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'whisper-cpp-local';

  constructor(private readonly options: WhisperCppProviderOptions) {}

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const args = [
      '-m', this.options.modelPath,
      '-f', request.assetId,
      ...(request.wordTimestamps ? ['-ml', '1'] : []),
      ...(request.language ? ['-l', request.language] : []),
      '--output-json',
    ];

    const result = await this.options.spawn(this.options.executablePath, args);
    if (result.exitCode !== 0) throw new Error(`whisper.cpp exited with code ${result.exitCode}: ${result.stderr}`);

    const parsed = JSON.parse(result.stdout) as { transcription?: Array<{ offsets?: { from?: number; to?: number }; text: string; tokens?: Array<{ text: string; offsets?: { from?: number; to?: number }; p?: number }> }> };
    const segments: TranscriptSegment[] = (parsed.transcription ?? []).map((segment, index) => ({
      id: `whisper-${index}`,
      startSeconds: ((segment.offsets?.from ?? 0) / 1000),
      endSeconds: ((segment.offsets?.to ?? 0) / 1000),
      text: segment.text.trim(),
      words: segment.tokens?.map((token): TranscriptWord => ({
        text: token.text,
        startSeconds: (token.offsets?.from ?? 0) / 1000,
        endSeconds: (token.offsets?.to ?? 0) / 1000,
        confidence: token.p,
      })),
    }));

    return { providerId: this.id, assetId: request.assetId, segments, language: request.language, metadata: { engine: 'whisper.cpp' } };
  }
}
