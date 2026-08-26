import type { TranscriptSegment } from './transcript-audio-bridge.js';

export type TranscriptionRequest = {
  assetId: string;
  language?: string;
  wordTimestamps?: boolean;
};

export type TranscriptionResult = {
  providerId: string;
  assetId: string;
  segments: TranscriptSegment[];
  language?: string;
  durationSeconds?: number;
  metadata?: Record<string, unknown>;
};

export interface TranscriptionProvider {
  readonly id: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

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
