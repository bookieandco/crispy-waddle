import type { MediaSource, MediaSourceAdapter } from './source-adapter';

export type PlaybackCapability = 'playback' | 'seek' | 'captions';

export interface PlaybackRequest {
  providerId: string;
  titleId: string;
  sourceId?: string;
}

export interface ResolvedPlaybackSource {
  providerId: string;
  source: MediaSource;
  capabilities: readonly PlaybackCapability[];
}

export interface PlaybackResolverProvider {
  readonly id: string;
  readonly adapter: MediaSourceAdapter;
  readonly authorized: boolean;
  readonly capabilities?: readonly PlaybackCapability[];
}

export interface PlaybackResolver {
  resolve(request: PlaybackRequest): Promise<ResolvedPlaybackSource>;
}

const DEFAULT_CAPABILITIES: readonly PlaybackCapability[] = ['playback', 'seek'];

function assertProviderId(providerId: string): void {
  if (!providerId || providerId.length > 128) throw new Error('Invalid playback provider.');
}

function assertSource(source: MediaSource): void {
  if (!source.url.startsWith('https://')) throw new Error('Playback source must use HTTPS.');
  if (!source.id || !source.titleId) throw new Error('Playback source is incomplete.');
}

export function createPlaybackResolver(providers: readonly PlaybackResolverProvider[]): PlaybackResolver {
  const registry = new Map(providers.map((provider) => [provider.id, provider]));

  return {
    async resolve(request) {
      assertProviderId(request.providerId);
      const provider = registry.get(request.providerId);
      if (!provider) throw new Error(`Unknown playback provider: ${request.providerId}`);
      if (!provider.authorized) throw new Error(`Playback provider is not authorized: ${request.providerId}`);

      const sources = await provider.adapter.getSources(request.titleId);
      const candidates = sources.filter((source) => !request.sourceId || source.id === request.sourceId);
      if (!candidates.length) throw new Error('No authorized playback source is available.');

      const source = candidates[0];
      assertSource(source);
      const capabilities = provider.capabilities?.length ? provider.capabilities : DEFAULT_CAPABILITIES;
      return { providerId: provider.id, source, capabilities: [...capabilities] };
    },
  };
}
