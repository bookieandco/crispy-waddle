export type MusicSourceKind = "spotify" | "youtube_music" | "youtube" | "local" | "authorized_service" | "import";
export type MediaAssetKind = "stream" | "file" | "external_reference";
export interface Artist { id: string; name: string; sortName?: string; externalIds?: Record<string, string>; }
export interface Album { id: string; title: string; artistIds: string[]; releaseDate?: string; artworkId?: string; externalIds?: Record<string, string>; }
export interface Track { id: string; title: string; artistIds: string[]; albumId?: string; durationMs?: number; trackNumber?: number; discNumber?: number; isrc?: string; explicit?: boolean; artworkId?: string; externalIds?: Record<string, string>; }
export interface Playlist { id: string; name: string; trackIds: string[]; ownerUserId: string; sourceId?: string; }
export interface MusicSource { id: string; userId: string; kind: MusicSourceKind; name: string; externalAccountId?: string; authorized: boolean; metadata: Record<string, unknown>; }
export interface MediaAsset { id: string; trackId: string; sourceId: string; kind: MediaAssetKind; uri: string; mimeType?: string; codec?: string; bitrate?: number; lossless?: boolean; durationMs?: number; provenance?: Record<string, unknown>; }
export interface Artwork { id: string; uri: string; width?: number; height?: number; source?: string; }
export interface Lyrics { id: string; trackId: string; text: string; synced?: boolean; source?: string; }
export interface MatchCandidate { assetId: string; score: number; reasons: string[]; }
export interface MatchResult { trackId: string; candidates: MatchCandidate[]; }
export interface ListeningEvent { id: string; userId: string; trackId: string; sourceId?: string; startedAt: string; endedAt?: string; positionMs?: number; completed: boolean; skipped: boolean; }
export interface ImportJob { id: string; userId: string; sourceId?: string; input: string; status: "queued" | "running" | "completed" | "failed"; importedTrackIds: string[]; error?: string; createdAt: string; updatedAt: string; }
