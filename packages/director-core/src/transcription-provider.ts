import type { Transcript, TranscriptionProvider } from './transcript-core.js';

export type TranscriptionRequest = {
  assetId: string;
  mediaUri: string;
  language?: string;
  wordTimestamps?: boolean;
};

export type TranscriptionResult = Transcript;
export type { TranscriptionProvider } from './transcript-core.js';

/** Registry for canonical DirectorOS transcription providers. */
export class TranscriptionProviderRegistry {
  private readonly providers = new Map<string, TranscriptionProvider>();

  register(provider: TranscriptionProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Transcription provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
  }

  get(providerId: string): TranscriptionProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new Error(`Unknown transcription provider: ${providerId}`);
    return provider;
  }

  list(): string[] {
    return [...this.providers.keys()];
  }
}
