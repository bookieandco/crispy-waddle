import { normalizeYouTubeMusicImport, searchTracks } from "@jhadina/music-core";
import type { MediaAsset, MusicRepository, Track, YouTubeMusicTrackInput } from "@jhadina/music-core";

/** Provider metadata is not a playback grant. Actual media assets must be independently admitted. */
export class MusicInputError extends Error {}

export interface YouTubeCatalogPayload {
  sourceId?: string;
  tracks?: YouTubeMusicTrackInput[];
}

function validTrack(value: unknown): value is YouTubeMusicTrackInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const track = value as Partial<YouTubeMusicTrackInput>;
  return typeof track.videoId === "string" && /^[A-Za-z0-9_-]{4,128}$/.test(track.videoId)
    && typeof track.title === "string" && track.title.trim().length > 0 && track.title.length <= 300
    && Array.isArray(track.artists) && track.artists.length > 0 && track.artists.length <= 20
    && track.artists.every((artist) => typeof artist === "string" && artist.trim().length > 0 && artist.length <= 200)
    && (track.album === undefined || (typeof track.album === "string" && track.album.length <= 300))
    && (track.playlistId === undefined || (typeof track.playlistId === "string" && track.playlistId.length <= 200))
    && (track.durationMs === undefined || (Number.isInteger(track.durationMs) && track.durationMs >= 0 && track.durationMs <= 86400000))
    && (track.explicit === undefined || typeof track.explicit === "boolean");
}

export async function importYouTubeCatalog(
  repository: MusicRepository,
  userId: string,
  payload: YouTubeCatalogPayload,
) {
  if (!payload || typeof payload.sourceId !== "string" || !/^[A-Za-z0-9:_-]{1,128}$/.test(payload.sourceId)) {
    throw new MusicInputError("A valid sourceId is required");
  }
  if (!Array.isArray(payload.tracks) || payload.tracks.length < 1 || payload.tracks.length > 250 || !payload.tracks.every(validTrack)) {
    throw new MusicInputError("Provide between 1 and 250 valid track metadata records");
  }
  const imported = normalizeYouTubeMusicImport(payload.sourceId, payload.tracks);
  // A metadata import never marks a music source as licensed, owned, or playable.
  await repository.upsertSource({
    id: imported.sourceId,
    userId,
    kind: "youtube_music",
    name: "YouTube Music (catalog)",
    authorized: false,
    metadata: { provider: "youtube_music", role: "catalog-library", importedAt: new Date().toISOString() },
  });
  for (const artist of imported.artists) await repository.upsertArtist(userId, artist);
  for (const track of imported.tracks) await repository.upsertTrack(userId, track);
  return { ...imported, count: imported.tracks.length };
}

export async function searchMusicCatalog(repository: MusicRepository, userId: string, query: string) {
  return searchTracks(await repository.listTracks(userId), query);
}

function safePlayableUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** A separate, server-side playback grant is mandatory even after catalog import. */
export async function resolveMusicPlayback(repository: MusicRepository, userId: string, trackId: string) {
  const track: Track | null = await repository.getTrack(userId, trackId);
  if (!track) return null;
  const [sources, assets] = await Promise.all([
    repository.listSources(userId),
    repository.listAssets(userId, track.id),
  ]);
  const permitted = new Set(sources.filter((source) => source.userId === userId && source.authorized).map((source) => source.id));
  const asset: MediaAsset | undefined = assets.find((candidate) =>
    candidate.trackId === track.id && permitted.has(candidate.sourceId)
    && (candidate.kind === "stream" || candidate.kind === "file")
    && candidate.provenance?.playbackAuthorized === true
    && safePlayableUrl(candidate.uri)
    && (typeof candidate.provenance?.expiresAt !== "string"
      || (Number.isFinite(Date.parse(candidate.provenance.expiresAt)) && Date.parse(candidate.provenance.expiresAt) > Date.now())),
  );
  return asset ? { trackId: track.id, sourceUri: asset.uri, sourceId: asset.sourceId } : null;
}
