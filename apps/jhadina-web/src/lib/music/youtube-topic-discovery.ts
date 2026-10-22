import {
  ATWOOD_BOOKIE_TOPIC_CHANNEL_ID,
  type TopicVideo,
} from '@jhadina/music-core';

export type TopicDiscoveryState =
  | 'ready' | 'configuration_required' | 'channel_unavailable' | 'uploads_unavailable' | 'provider_error';

export interface TopicDiscovery {
  state: TopicDiscoveryState;
  channelTitle: string | null;
  videos: readonly TopicVideo[];
  pagesFetched: number;
  truncated: boolean;
  message?: string;
}

type ChannelResponse = {
  items?: Array<{
    id?: string;
    snippet?: {title?: string};
    contentDetails?: {relatedPlaylists?: {uploads?: string}};
  }>;
};
type PlaylistResponse = {
  items?: Array<{
    snippet?: {title?: string; resourceId?: {kind?: string; videoId?: string}};
    contentDetails?: {videoId?: string};
  }>;
  nextPageToken?: string;
};

async function getYouTubeJson<T>(
  path: 'channels' | 'playlistItems',
  params: Record<string, string>,
  key: string,
  fetcher: typeof fetch,
): Promise<T> {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + path);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set('key', key);
  // Do not return the URL: it contains the server-side credential.
  const response = await fetcher(url.toString(), {cache: 'no-store', signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('YOUTUBE_DATA_API_HTTP_' + response.status);
  return await response.json() as T;
}

/**
 * Official Data API only. No scraping, downloadable media, OAuth impersonation
 * or entitlement inference. Discovery does not update the Music database.
 */
export async function discoverAtwoodBookieTopic(
  options: {apiKey?: string; fetcher?: typeof fetch; maxPages?: number} = {},
): Promise<TopicDiscovery> {
  const apiKey = options.apiKey ?? process.env.YOUTUBE_API_KEY ?? process.env.GOOGLE_YOUTUBE_API_KEY;
  if (!apiKey) return {
    state: 'configuration_required', channelTitle: null, videos: [], pagesFetched: 0,
    truncated: false, message: 'Configure the server-side YouTube Data API key to scan the public Topic catalog.',
  };
  const fetcher = options.fetcher ?? fetch;
  try {
    const channel = await getYouTubeJson<ChannelResponse>('channels', {
      part: 'snippet,contentDetails', id: ATWOOD_BOOKIE_TOPIC_CHANNEL_ID,
    }, apiKey, fetcher);
    const found = channel.items?.find((item) => item.id === ATWOOD_BOOKIE_TOPIC_CHANNEL_ID);
    if (!found) return {
      state: 'channel_unavailable', channelTitle: null, videos: [], pagesFetched: 0,
      truncated: false, message: 'YouTube did not return the requested public channel.',
    };
    const channelTitle = found.snippet?.title ?? '';
    // Do not attach unrelated channel content to the artist even if an ID is
    // misconfigured or upstream data changes.
    if (!/atwood\s+bookie/i.test(channelTitle)) return {
      state: 'channel_unavailable', channelTitle, videos: [], pagesFetched: 0,
      truncated: false, message: 'Channel title needs owner review before catalog association.',
    };
    const uploads = found.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return {
      state: 'uploads_unavailable', channelTitle, videos: [], pagesFetched: 0,
      truncated: false, message: 'This Topic channel does not expose an uploads playlist through the public API.',
    };
    const maxPages = Math.max(1, Math.min(4, Math.floor(options.maxPages ?? 2)));
    const videos: TopicVideo[] = [];
    let token: string | undefined;
    let pagesFetched = 0;
    for (let page = 0; page < maxPages; page++) {
      const response = await getYouTubeJson<PlaylistResponse>('playlistItems', {
        part: 'snippet,contentDetails', playlistId: uploads, maxResults: '50',
        ...(token ? {pageToken: token} : {}),
      }, apiKey, fetcher);
      pagesFetched++;
      for (const item of response.items ?? []) {
        const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
        if (!videoId || !item.snippet?.title) continue;
        videos.push({videoId, title: item.snippet.title});
      }
      token = response.nextPageToken;
      if (!token) break;
    }
    return {
      state: 'ready', channelTitle, videos, pagesFetched, truncated: Boolean(token),
    };
  } catch (error) {
    const code = error instanceof Error && /^YOUTUBE_DATA_API_HTTP_\d+$/.test(error.message)
      ? error.message : 'YOUTUBE_TOPIC_DISCOVERY_FAILED';
    return {
      state: 'provider_error', channelTitle: null, videos: [], pagesFetched: 0,
      truncated: false, message: code,
    };
  }
}
