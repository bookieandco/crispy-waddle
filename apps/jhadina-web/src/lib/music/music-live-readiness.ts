/**
 * A read-only per-user readiness ledger for the Music streaming environment.
 * Passing these probes is necessary but not sufficient for a real playable-source receipt.
 */
export type DependencyState = "ready" | "blocked";
export interface MusicDependencyProbe {
  catalog(userId: string): Promise<boolean>;
  checkpoint(userId: string): Promise<boolean>;
  ownedStorage(userId: string): Promise<boolean>;
  grantedSources(userId: string): Promise<number>;
  playbackCandidates(userId: string): Promise<number>;
}
export interface MusicLiveReadiness {
  status: "environment_ready_for_playback_drill" | "needs_configuration";
  catalog: DependencyState;
  checkpoint: DependencyState;
  ownedStorage: DependencyState;
  authorizedSourceCount: number;
  playbackCandidateCount: number;
  livePlaybackCertified: false;
  missing: string[];
}

export async function inspectMusicLiveReadiness(
  userId: string, probe: MusicDependencyProbe,
): Promise<MusicLiveReadiness> {
  if (!userId) throw new Error("Authenticated Music identity required");
  const safe = async <T>(fn: () => Promise<T>, fallback: T) => {
    try { return await fn(); } catch { return fallback; }
  };
  const [catalog, checkpoint, ownedStorage, count, playable] = await Promise.all([
    safe(() => probe.catalog(userId), false),
    safe(() => probe.checkpoint(userId), false),
    safe(() => probe.ownedStorage(userId), false),
    safe(() => probe.grantedSources(userId), 0),
    safe(() => probe.playbackCandidates(userId), 0),
  ]);
  const missing: string[] = [];
  if (!catalog) missing.push("music_catalog_database");
  if (!checkpoint) missing.push("music_checkpoint_migration");
  if (!ownedStorage) missing.push("owned_audio_bucket_or_read_policy");
  if (count < 1) missing.push("authorized_audio_source");
  if (playable < 1) missing.push("authorized_playback_asset_candidate");
  return {
    status: missing.length ? "needs_configuration" : "environment_ready_for_playback_drill",
    catalog: catalog ? "ready" : "blocked",
    checkpoint: checkpoint ? "ready" : "blocked",
    ownedStorage: ownedStorage ? "ready" : "blocked",
    authorizedSourceCount: count,
    playbackCandidateCount: playable,
    livePlaybackCertified: false,
    missing,
  };
}
