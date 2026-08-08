import type { Artist, Track } from "./types.js";

export interface YouTubeMusicTrackInput {
  videoId: string;
  title: string;
  artists: string[];
  album?: string;
  durationMs?: number;
  explicit?: boolean;
  playlistId?: string;
}

export interface YouTubeMusicTasteImport {
  sourceId: string;
  tracks: Track[];
  artists: Artist[];
  playlistNames: string[];
}

const idFor = (prefix: string, value: string): string =>
  `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;

/**
 * Normalizes authorized YouTube Music metadata into Music Core records.
 * This adapter intentionally handles metadata only; it does not extract,
 * decrypt, or bypass protected media streams.
 */
export function normalizeYouTubeMusicImport(
  sourceId: string,
  input: YouTubeMusicTrackInput[],
): YouTubeMusicTasteImport {
  const artistsById = new Map<string, Artist>();
  const tracks: Track[] = [];
  const playlistNames = new Set<string>();

  for (const item of input) {
    const artistIds = item.artists.map((name) => {
      const id = idFor("ytm_artist", name);
      if (!artistsById.has(id)) artistsById.set(id, { id, name });
      return id;
    });

    if (item.playlistId) playlistNames.add(item.playlistId);

    tracks.push({
      id: idFor("ytm_track", item.videoId),
      title: item.title,
      artistIds,
      albumId: item.album ? idFor("ytm_album", item.album) : undefined,
      durationMs: item.durationMs,
      explicit: item.explicit,
      externalIds: { youtube: item.videoId, source: sourceId },
    });
  }

  return {
    sourceId,
    tracks,
    artists: [...artistsById.values()],
    playlistNames: [...playlistNames],
  };
}
