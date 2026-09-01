import type { MediaTitle } from './index';
import type { MediaSource, MediaSourceAdapter } from './source-adapter';

export interface AuthorizedYouTubeCatalogClient {
  search(query: string): Promise<MediaTitle[]>;
  sources(titleId: string): Promise<MediaSource[]>;
}

/**
 * Authorized YouTube catalog boundary.
 *
 * YouTube URLs are represented as external playback sources; this adapter does
 * not pretend that a watch/embed URL is a native HLS/DASH media stream.
 */
export function createYouTubePlaybackAdapter(
  client: AuthorizedYouTubeCatalogClient,
  config: { id?: string; name?: string } = {},
): MediaSourceAdapter {
  const id = config.id ?? 'youtube';
  const name = config.name ?? 'YouTube';
  if (!id || id.length > 128) throw new Error('Invalid YouTube playback provider.');

  return {
    id,
    name,
    search: (query) => client.search(query),
    async getSources(titleId) {
      if (!titleId) throw new Error('Invalid playback title.');
      const sources = await client.sources(titleId);
      return sources.map((source) => {
        if (!source.url.startsWith('https://')) {
          throw new Error('YouTube playback source must use HTTPS.');
        }
        return source;
      });
    },
  };
}
