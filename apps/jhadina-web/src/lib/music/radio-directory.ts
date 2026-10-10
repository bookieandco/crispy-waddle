import type { MusicRepository, Track } from "@jhadina/music-core";
import { validatePlaybackAsset } from "@jhadina/music-core";

export interface CuratedRadioStation {
  trackId: string;
  title: string;
  publisher: string;
  rightsEvidenceRef: string;
  available: true;
}

/** List only reviewed, currently authorized, user-owned radio catalog entries. */
export async function listCuratedRadioStations(repository: MusicRepository, userId: string): Promise<CuratedRadioStation[]> {
  if (!userId) return [];
  const [tracks, sources] = await Promise.all([repository.listTracks(userId), repository.listSources(userId)]);
  const radio = tracks.filter((track: Track) => track.id.startsWith("radio:")).slice(0, 150);
  const resolved = await Promise.all(radio.map(async track => {
    const assets = await repository.listAssets(userId, track.id);
    for (const asset of assets) {
      const source = sources.find(candidate => candidate.id === asset.sourceId && candidate.authorized && candidate.userId === userId);
      if (!source || source.metadata.mediaKind !== "internet_radio"
        || typeof source.metadata.rightsEvidenceRef !== "string" || !source.metadata.rightsEvidenceRef) continue;
      if (!validatePlaybackAsset(userId, track.id, sources, asset)) continue;
      return { trackId: track.id, title: track.title, publisher: source.name,
        rightsEvidenceRef: source.metadata.rightsEvidenceRef, available: true as const };
    }
    return null;
  }));
  return resolved.filter((entry): entry is CuratedRadioStation => entry !== null);
}
