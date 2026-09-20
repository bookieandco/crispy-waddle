export type MusicPlatform = "soundcloud" | "youtube" | "spotify" | "apple_music" | "youtube_music" | "amazon_music" | "tidal" | "deezer" | "jhadina_music"

export type ReleasePackage = {
  releaseId: string
  title: string
  artist: string
  releaseDate: string
  audioMasterUrl: string
  artworkUrl: string
  metadata: Record<string, string | number | string[]>
}

export type DistributionResult = {
  platform: MusicPlatform
  status: "QUEUED" | "SUBMITTED" | "LIVE" | "FAILED"
  externalId?: string
  url?: string
  message?: string
}

export interface DistributionAdapter {
  platform: MusicPlatform
  submit(release: ReleasePackage): Promise<DistributionResult>
  status(externalId: string): Promise<DistributionResult>
}

/**
 * Provider-neutral distribution coordinator. The referenced music-distro
 * project demonstrates direct SoundCloud/YouTube workflows; Jhadina keeps
 * those integrations behind adapters so additional DSP relationships can be
 * added without changing the release/catalog model.
 */
export async function distributeRelease(release: ReleasePackage, adapters: DistributionAdapter[]) {
  const results: DistributionResult[] = []
  for (const adapter of adapters) {
    try {
      results.push(await adapter.submit(release))
    } catch (error) {
      results.push({ platform: adapter.platform, status: "FAILED", message: error instanceof Error ? error.message : "Distribution failed" })
    }
  }
  return results
}
