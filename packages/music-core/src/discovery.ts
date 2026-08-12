export type DiscoverySourceKind = 'youtube' | 'local' | 'authorized_provider';

export type Artwork = {
  url: string;
  width?: number;
  height?: number;
  source: DiscoverySourceKind;
  attribution?: string;
};

export type MusicItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  trackNumber?: number;
  durationMs?: number;
  artwork?: Artwork;
  source: DiscoverySourceKind;
  sourceUrl?: string;
  playable: boolean;
  localAsset?: boolean;
  rightsStatus: 'owned' | 'licensed' | 'authorized_stream' | 'unknown';
};

export type DiscoveryPreferences = {
  seed?: string;
  artists?: string[];
  genres?: string[];
  includeDeepCuts?: boolean;
  includeMixtapes?: boolean;
  includeLive?: boolean;
  includeRemixes?: boolean;
};

/**
 * MusicOS discovery is intentionally metadata/playback oriented.
 * It may surface public/authorized YouTube results but must not bypass
 * platform controls or infer that an unofficial upload is copyright-free.
 */
export type DiscoveryResult = MusicItem & {
  discoveryReason: 'artist' | 'similarity' | 'deep_cut' | 'mixtape' | 'history' | 'new_release' | 'manual';
  confidence?: number;
};

export function canImportToLocalLibrary(item: MusicItem): boolean {
  return item.localAsset === true || item.rightsStatus === 'owned' || item.rightsStatus === 'licensed';
}

export function buildDiscoveryQuery(preferences: DiscoveryPreferences): string {
  const parts = [
    ...(preferences.artists ?? []),
    ...(preferences.genres ?? []),
    preferences.includeMixtapes ? 'mixtape' : '',
    preferences.includeDeepCuts ? 'deep cuts' : '',
    preferences.includeLive ? 'live' : '',
    preferences.includeRemixes ? 'remix' : '',
    preferences.seed ?? ''
  ].filter(Boolean);

  return parts.join(' ').trim();
}
