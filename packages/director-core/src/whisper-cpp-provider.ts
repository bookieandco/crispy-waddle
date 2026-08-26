import type { Transcript, TranscriptionProvider } from './transcript-core.js';

export type WhisperCppProviderOptions = {
  executablePath: string;
  modelPath: string;
  spawn: (command: string, args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
};

/** Local whisper.cpp adapter. The rest of DirectorOS only consumes transcript-core types. */
export class WhisperCppTranscriptionProvider implements TranscriptionProvider {
  readonly id = 'whisper-cpp-local';

  constructor(private readonly options: WhisperCppProviderOptions) {}

  async transcribe(input: { assetId: string; mediaUri: string; language?: string }): Promise<Transcript> {
    const args = [
      '-m', this.options.modelPath,
      '-f', input.mediaUri,
      ...(input.language ? ['-l', input.language] : []),
      '--output-json',
    ];
    const result = await this.options.spawn(this.options.executablePath, args);
    if (result.exitCode !== 0) throw new Error(`whisper.cpp exited with code ${result.exitCode}: ${result.stderr}`);

    const parsed = JSON.parse(result.stdout) as {
      transcription?: Array<{
        offsets?: { from?: number; to?: number };
        text: string;
        tokens?: Array<{ text: string; offsets?: { from?: number; to?: number }; p?: number }>;
      }>;
    };

    const segments = (parsed.transcription ?? []).map((segment, index) => ({
      id: `whisper-${index}`,
      startSeconds: (segment.offsets?.from ?? 0) / 1000,
      endSeconds: (segment.offsets?.to ?? 0) / 1000,
      text: segment.text.trim(),
      words: (segment.tokens ?? []).map(token => ({
        text: token.text,
        startSeconds: (token.offsets?.from ?? 0) / 1000,
        endSeconds: (token.offsets?.to ?? 0) / 1000,
        confidence: token.p,
      })),
    }));

    return {
      id: crypto.randomUUID(),
      assetId: input.assetId,
      language: input.language,
      segments,
      provider: this.id,
      model: this.options.modelPath,
      createdAt: new Date().toISOString(),
    };
  }
}
