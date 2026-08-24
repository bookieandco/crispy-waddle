import type { LiveChannel, LiveChannelProvider } from '@jhadina/tv-core';
import { m3uRecordsToChannels, parseM3u } from './m3u';

export interface M3uProviderConfig {
  id?: string;
  name?: string;
  provenance?: LiveChannel['provenance'];
}

export function createM3uProvider(text: string, config: M3uProviderConfig = {}): LiveChannelProvider {
  const channels = m3uRecordsToChannels(parseM3u(text), config.provenance ?? 'public-free');
  return {
    id: config.id ?? 'm3u',
    name: config.name ?? 'M3U Live TV',
    async listChannels() {
      return channels;
    },
  };
}

export { m3uRecordsToChannels, parseM3u } from './m3u';
export type { M3uChannelRecord } from './m3u';
