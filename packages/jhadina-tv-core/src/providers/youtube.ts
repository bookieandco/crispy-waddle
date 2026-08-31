import type { MediaItem, MediaProvider, MediaProviderCapabilities, MediaSourceReference } from '../media-domain';

export interface YouTubeProviderConfig {
  /** Public YouTube Data API key supplied by the runtime, never persisted in Media Core. */
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface YouTubeSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: { high?: { url?: string }; default?: { url?: string } };
    };
  }>;
}

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3/search';

export function createYouTubeProvider(config: YouTubeProviderConfig): MediaProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const capabilities: MediaProviderCapabilities = {
    kinds: ['video', 'movie', 'show', 'episode', 'track'],
    supportsSearch: true,
    supportsBrowse: false,
    supportsSourceResolution: false,
  };

  return {
    id: 'youtube',
    name: 'YouTube',
    capabilities,
    async search(query): Promise<MediaItem[]> {
      const url = new URL(YOUTUBE_API);
      url.searchParams.set('part', 'snippet');
      url.searchParams.set('type', 'video');
      url.searchParams.set('maxResults', '25');
      url.searchParams.set('q', query);
      url.searchParams.set('key', config.apiKey);

      const response = await fetchImpl(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`YouTube search failed: ${response.status}`);

      const payload = (await response.json()) as YouTubeSearchResponse;
      return (payload.items ?? []).flatMap((item) => {
        const videoId = item.id?.videoId;
        if (!videoId) return [];
        const snippet = item.snippet ?? {};
        return [{
          id: videoId,
          providerId: 'youtube',
          provider: 'youtube',
          kind: 'video',
          title: snippet.title ?? 'YouTube video',
          subtitle: snippet.channelTitle,
          description: snippet.description,
          artworkUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url,
          canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
          capabilities: ['play', 'seek', 'queue'],
          metadata: {
            channelTitle: snippet.channelTitle ?? null,
            publishedAt: snippet.publishedAt ?? null,
          },
        } satisfies MediaItem];
      });
    },
    async get(id) {
      return {
        id,
        providerId: 'youtube',
        provider: 'youtube',
        kind: 'video',
        title: 'YouTube video',
        canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
        capabilities: ['play', 'seek', 'queue'],
      };
    },
    async resolveSources(_id): Promise<MediaSourceReference[]> {
      // Playback must go through an authorized YouTube player/embed surface.
      // Media Core deliberately does not extract or proxy protected media URLs.
      return [];
    },
    async health() {
      return { ok: Boolean(config.apiKey), message: config.apiKey ? undefined : 'YouTube API key is not configured' };
    },
  };
}
