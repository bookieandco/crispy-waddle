export type MusicLibraryItem = {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  sourceUrl?: string;
  localAssetUrl?: string;
  rightsStatus: 'owned' | 'licensed' | 'authorized_stream' | 'unknown';
  favorite: boolean;
  addedAt: string;
};

export type MusicPlaylist = {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  trackIds: string[];
  offlineEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OfflineDownload = {
  id: string;
  trackId: string;
  localAssetUrl: string;
  bytes?: number;
  downloadedAt: string;
  status: 'queued' | 'downloading' | 'available' | 'failed' | 'removed';
  error?: string;
};

/** Only owned or licensed audio can be persisted as an offline asset. */
export function canDownloadOffline(item: Pick<MusicLibraryItem, 'rightsStatus'>): boolean {
  return item.rightsStatus === 'owned' || item.rightsStatus === 'licensed';
}

export function toggleFavorite(item: MusicLibraryItem): MusicLibraryItem {
  return { ...item, favorite: !item.favorite };
}

export function addToPlaylist(playlist: MusicPlaylist, trackId: string): MusicPlaylist {
  if (playlist.trackIds.includes(trackId)) return playlist;
  return { ...playlist, trackIds: [...playlist.trackIds, trackId], updatedAt: new Date().toISOString() };
}

export function removeFromPlaylist(playlist: MusicPlaylist, trackId: string): MusicPlaylist {
  return { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId), updatedAt: new Date().toISOString() };
}
