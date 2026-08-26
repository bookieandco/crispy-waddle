import type { Transcript, TranscriptionProvider } from './transcript-core';

export type TranscriptionJobStatus = 'queued' | 'running' | 'completed' | 'failed';
export type TranscriptionJob = { id: string; assetId: string; mediaUri: string; status: TranscriptionJobStatus; providerId: string; transcript?: Transcript; error?: string };
export type TranscriptionJobStore = { save(job: TranscriptionJob): Promise<TranscriptionJob> };

export class TranscriptionService {
  constructor(private readonly provider: TranscriptionProvider, private readonly store: TranscriptionJobStore) {}
  async run(input: { jobId: string; assetId: string; mediaUri: string; language?: string }): Promise<TranscriptionJob> {
    let job: TranscriptionJob = { id: input.jobId, assetId: input.assetId, mediaUri: input.mediaUri, status: 'queued', providerId: this.provider.id };
    await this.store.save(job); job = { ...job, status: 'running' }; await this.store.save(job);
    try { job = { ...job, status: 'completed', transcript: await this.provider.transcribe({ assetId: input.assetId, mediaUri: input.mediaUri, language: input.language }) }; }
    catch (error) { job = { ...job, status: 'failed', error: error instanceof Error ? error.message : String(error) }; }
    return this.store.save(job);
  }
}

export type WhisperCppRunner = { run(input: { mediaUri: string; language?: string }): Promise<{ transcript: Transcript }> };
export class WhisperCppProvider implements TranscriptionProvider {
  readonly id = 'whisper.cpp';
  constructor(private readonly runner: WhisperCppRunner, private readonly model = 'whisper.cpp') {}
  async transcribe(input: { assetId: string; mediaUri: string; language?: string }): Promise<Transcript> {
    const result = await this.runner.run({ mediaUri: input.mediaUri, language: input.language });
    return { ...result.transcript, assetId: input.assetId, provider: this.id, model: this.model };
  }
}
