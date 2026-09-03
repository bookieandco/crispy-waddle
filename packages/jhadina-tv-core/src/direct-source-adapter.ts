import type { MediaTitle } from './index';
import type { MediaSource, MediaSourceAdapter } from './source-adapter';
import { assertPlayableSource } from './source-adapter';

export interface DirectSourceCatalogClient {
  search(query: string): Promise<MediaTitle[]>;
  getSources(titleId: string): Promise<MediaSource[]>;
}

/** Authorized adapter for first-party/direct HLS, DASH, and external sources. */
export function createDirectSourceAdapter(
  client: DirectSourceCatalogClient,
  config: { id: string; name: string },
): MediaSourceAdapter {
  if (!config.id || config.id.length > 128) throw new Error('Invalid direct playback provider.');

  return {
    id: config.id,
    name: config.name,
    search: (query) => client.search(query),
    async getSources(titleId) {
      if (!titleId) throw new Error('Invalid playback title.');
      return (await client.getSources(titleId)).map(assertPlayableSource);
    },
  };
}
