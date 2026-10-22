import {normalizeYouTubeMusicImport} from './youtube-music.js';

export const ATWOOD_BOOKIE_TOPIC_CHANNEL_ID = 'UC4fAVLUoIqgKkOV0JMAX7Rg' as const;
export const ATWOOD_BOOKIE_TOPIC_CHANNEL_URL =
  'https://music.youtube.com/channel/' + ATWOOD_BOOKIE_TOPIC_CHANNEL_ID;

export interface TopicVideo {
  videoId: string;
  title: string;
}

export interface CatalogSong {
  id: string;
  title: string;
  songKey?: string;
}

export interface TopicReconciliation {
  videoId: string;
  videoTitle: string;
  youtubeUrl: string;
  normalizedTrackId: string;
  state: 'matched' | 'review' | 'unmatched';
  matchedSongId?: string;
  matchedSongKey?: string;
  candidates: readonly string[];
  rights: 'UNVERIFIED';
  playback: 'EXTERNAL_LINK_ONLY';
  analytics: 'NOT_AUTHORIZED';
}

export function normalizeTopicTitle(value: string): string {
  return value
    .replace(/^atwood bookie\s*[-–:]\s*/i, '')
    .replace(/\s*(?:\((?:official (?:audio|video|music video)|audio|visualizer|lyrics?)\)|\[(?:official (?:audio|video)|audio|visualizer|lyrics?)\])\s*$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Metadata comparison only. Ambiguous or unmatched videos are NOT new songs.
 * No video in this result is a licensed media file or evidence of a connected
 * creator / YouTube Analytics account.
 */
export function reconcileTopicChannelCatalog(
  videos: readonly TopicVideo[],
  songs: readonly CatalogSong[],
): readonly TopicReconciliation[] {
  const byName = new Map<string, CatalogSong[]>();
  for (const song of songs) {
    const key = normalizeTopicTitle(song.title);
    if (!key || !song.id.trim()) continue;
    byName.set(key, [...(byName.get(key) ?? []), song]);
  }

  const seen = new Set<string>();
  return Object.freeze(videos.flatMap((video) => {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(video.videoId) || seen.has(video.videoId)) return [];
    seen.add(video.videoId);
    if (!video.title.trim() || /^(private|deleted) video$/i.test(video.title.trim())) return [];
    const matches = byName.get(normalizeTopicTitle(video.title)) ?? [];
    const normalized = normalizeYouTubeMusicImport(
      'youtube_music:topic:' + ATWOOD_BOOKIE_TOPIC_CHANNEL_ID,
      [{videoId: video.videoId, title: video.title, artists: ['Atwood Bookie']}],
    );
    const match = matches.length === 1 ? matches[0] : undefined;
    return [{
      videoId: video.videoId,
      videoTitle: video.title,
      youtubeUrl: 'https://www.youtube.com/watch?v=' + video.videoId,
      normalizedTrackId: normalized.tracks[0]!.id,
      state: matches.length === 1 ? 'matched' as const : matches.length > 1 ? 'review' as const : 'unmatched' as const,
      matchedSongId: match?.id,
      matchedSongKey: match?.songKey,
      candidates: Object.freeze(matches.map((song) => song.id)),
      rights: 'UNVERIFIED' as const,
      playback: 'EXTERNAL_LINK_ONLY' as const,
      analytics: 'NOT_AUTHORIZED' as const,
    }];
  }));
}
