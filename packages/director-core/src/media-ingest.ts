import type { MediaAsset, ProxyJob, ProxyProfile } from './media-core';
import type { MediaProcessor } from './media-processor';

export type MediaProbe = {
  durationSeconds?: number;
  width?: number;
  height?: number;
  frameRate?: number;
  audioChannels?: number;
  videoCodec?: string;
  audioCodec?: string;
};

export type MediaProbeProvider = {
  readonly id: string;
  probe(inputUri: string): Promise<MediaProbe>;
};

export type IngestRequest = {
  projectId: string;
  assetId: string;
  inputUri: string;
  proxyProfile: ProxyProfile;
  proxyOutputUri: string;
};

export type IngestResult = { asset: MediaAsset; proxyJob: ProxyJob };

export type AssetRegistrar = { register(asset: MediaAsset): Promise<MediaAsset> };

export class MediaIngestService {
  constructor(
    private readonly probeProvider: MediaProbeProvider,
    private readonly processor: MediaProcessor,
    private readonly registrar: AssetRegistrar,
  ) {}

  async ingest(request: IngestRequest): Promise<IngestResult> {
    const probe = await this.probeProvider.probe(request.inputUri);
    const asset = await this.registrar.register({
      id: request.assetId,
      projectId: request.projectId,
      uri: request.inputUri,
      kind: 'video',
      metadata: probe,
    } as MediaAsset);

    const proxyJob = {
      id: `${request.assetId}:proxy:${request.proxyProfile}`,
      projectId: request.projectId,
      assetId: asset.id,
      profile: request.proxyProfile,
      status: 'queued',
      inputUri: request.inputUri,
      outputUri: request.proxyOutputUri,
    } as ProxyJob;

    const args = request.proxyProfile === 'preview-540p'
      ? ['-vf', 'scale=-2:540', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k']
      : request.proxyProfile === 'preview-720p'
        ? ['-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-c:a', 'aac', '-b:a', '128k']
        : ['-vf', 'scale=-2:1080', '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-c:a', 'aac', '-b:a', '160k'];

    const result = await this.processor.process({
      requestId: proxyJob.id,
      projectId: request.projectId,
      inputUri: request.inputUri,
      outputUri: request.proxyOutputUri,
      args,
    });

    proxyJob.status = result.status === 'completed' ? 'completed' : 'failed';
    return { asset, proxyJob };
  }
}
