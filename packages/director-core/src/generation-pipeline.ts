import type { ContinuityManifest } from './continuity-manifest.js';
import type { TakeRequest } from './generation-orchestrator.js';
import { rankContinuity, type ContinuityCandidate, type ContinuityScore } from './continuity-qc.js';
import type { GenerationProviderRegistry, GenerationResult } from './provider-bridge.js';

export type RecordedTake = {
  id: string;
  projectId: string;
  sceneId: string;
  parentTakeId?: string;
  takeNumber: number;
  status: 'candidate';
  media: GenerationResult['media'];
  provider: string;
  providerJobId?: string;
  manifest: ContinuityManifest;
  variation?: string;
};

export type RankedGeneratedTake = ContinuityScore & Pick<RecordedTake, 'projectId' | 'sceneId' | 'parentTakeId' | 'takeNumber' | 'provider' | 'variation'>;

export interface TakeRecorder {
  record(take: RecordedTake): Promise<RecordedTake>;
}

export type ManifestBuilder = (input: {
  request: TakeRequest & { variation?: string };
  result: GenerationResult;
  takeId: string;
}) => Promise<ContinuityManifest> | ContinuityManifest;

export type GenerationPipelineInput = {
  request: TakeRequest & { variation?: string; takeNumber?: number };
  previousManifest: ContinuityManifest;
  providerId?: string;
};

export class GenerationPipeline {
  constructor(
    private readonly providers: GenerationProviderRegistry,
    private readonly recorder: TakeRecorder,
    private readonly buildManifest: ManifestBuilder,
  ) {}

  async generateRecordAndRank(input: GenerationPipelineInput): Promise<RankedGeneratedTake> {
    const takeId = crypto.randomUUID();
    const result = await this.providers.generate(input.providerId, input.request);
    const manifest = await this.buildManifest({ request: input.request, result, takeId });
    const take: RecordedTake = {
      id: takeId,
      projectId: input.request.projectId,
      sceneId: input.request.sceneId,
      parentTakeId: input.request.parentTakeId,
      takeNumber: input.request.takeNumber ?? input.request.takeCount ?? 1,
      status: 'candidate',
      media: result.media,
      provider: result.provider,
      providerJobId: result.providerJobId,
      manifest,
      variation: input.request.variation,
    };
    await this.recorder.record(take);
    const ranked = rankContinuity(input.previousManifest, [{
      takeId,
      manifest,
      previewUri: result.media.uri,
      thumbnailUri: result.media.thumbnailUri,
    }]);
    return { ...ranked[0], projectId: take.projectId, sceneId: take.sceneId, parentTakeId: take.parentTakeId, takeNumber: take.takeNumber, provider: take.provider, variation: take.variation };
  }

  async generateBatchAndRank(input: GenerationPipelineInput, requests: Array<TakeRequest & { variation?: string; takeNumber?: number }>) {
    const results = await Promise.all(requests.map((request) => this.generateRecordAndRank({ ...input, request })));
    return results.sort((a, b) => b.score - a.score);
  }
}
