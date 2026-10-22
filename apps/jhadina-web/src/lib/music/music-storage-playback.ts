import type { MusicRepository, PlaybackTicket } from "@jhadina/music-core";
import { validatePlaybackAsset } from "@jhadina/music-core";

/** User-scoped Supabase Storage adapter; only this one owned-media bucket is admitted. */
export interface MusicStorageSigner {
  sign(bucket: "music-owned", path: string, expiresIn: number): Promise<string | null>;
}

/**
 * Re-sign an explicitly authorized *owned* audio file instead of replaying
 * an expired credential stored in music_assets.uri. The signed URL is ephemeral.
 */
export async function resolveOwnedMusicStorage(
  repository: MusicRepository, userId: string, trackId: string,
  signer: MusicStorageSigner, nowMs = Date.now(),
): Promise<PlaybackTicket | null> {
  if (!userId || !trackId || !await repository.getTrack(userId, trackId)) return null;
  const [sources, assets] = await Promise.all([
    repository.listSources(userId), repository.listAssets(userId, trackId),
  ]);
  for (const asset of assets) {
    const bucket = asset.provenance?.storageBucket;
    const path = asset.provenance?.storagePath;
    if (asset.kind !== "file" || asset.provenance?.playbackAuthorized !== true
      || bucket !== "music-owned" || typeof path !== "string"
      || !path.startsWith(`${userId}/`)
      || !/^[A-Za-z0-9_./-]{1,500}$/.test(path)
      || path.split("/").some(part => part === "." || part === "..")
      || path.endsWith("/")) continue;
    const source = sources.find(s => s.id === asset.sourceId && s.userId === userId
      && s.authorized && s.metadata.role !== "catalog-library");
    if (!source) continue;
    // Authenticated SSR user signs their own object through Storage RLS;
    // an unprivileged browser cannot instruct us to sign another bucket/path.
    const signedUrl = await signer.sign("music-owned", path, 180);
    if (!signedUrl) continue;
    const expiry = new Date(nowMs + 180000).toISOString();
    const ticket = validatePlaybackAsset(userId, trackId, sources, {
      ...asset, uri: signedUrl,
      provenance: { ...asset.provenance, expiresAt: expiry },
    }, nowMs);
    if (ticket) return ticket;
  }
  return null;
}
