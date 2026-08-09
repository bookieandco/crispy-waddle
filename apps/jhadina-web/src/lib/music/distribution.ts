export type MusicDestination = "spotify" | "apple_music" | "youtube_music" | "amazon_music" | "tidal" | "deezer" | "soundcloud" | "youtube" | "jhadina_library"

export type Release = {
  id: string
  artist: string
  title: string
  version?: string
  audioAssetId: string
  artworkAssetId?: string
  releaseDate: string
  destinations: MusicDestination[]
  status: "DRAFT" | "READY" | "SUBMITTED" | "LIVE" | "FAILED"
  metadata: Record<string, string>
}

export function createRelease(input: Omit<Release, "id" | "status">): Release {
  if (!input.artist || !input.title || !input.audioAssetId) throw new Error("artist, title, and audioAssetId are required")
  if (!input.destinations.length) throw new Error("Select at least one distribution destination")
  return {
    ...input,
    id: `release_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: "DRAFT",
  }
}

/**
 * Provider-neutral distribution contract. Each destination gets its own adapter
 * for authentication, metadata mapping, upload, submission, and status polling.
 */
export interface MusicDistributor {
  destination: MusicDestination
  submit(release: Release): Promise<{ externalId: string; status: "SUBMITTED" | "LIVE" }>
  status(externalId: string): Promise<"SUBMITTED" | "LIVE" | "FAILED">
}
