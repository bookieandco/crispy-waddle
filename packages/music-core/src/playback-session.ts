import type { Track } from "./types.js";
import type { MusicControllerState } from "./music-controller.js";
import type { AuthorizedPlaybackResolver, UserPlaybackResult } from "./user-scoped-playback-resolver.js";
import type { PlaybackHost } from "./playback-host.js";

export type PlaybackSessionState = MusicControllerState & { resolvedAssetId?: string; error?: string };

/** Orchestrates resolution and playback without owning queue or provider logic. */
export class PlaybackSession {
  private state: PlaybackSessionState;
  constructor(private readonly resolver: AuthorizedPlaybackResolver, private readonly host: PlaybackHost, initial: MusicControllerState) { this.state = { ...initial }; }
  getState(): PlaybackSessionState { return this.state; }
  async load(track: Track): Promise<UserPlaybackResult> {
    this.state = { ...this.state, error: undefined };
    const result = await this.resolver.resolve({ userId: this.userId(), track, offlineOnly: this.state.offlineOnly });
    if (!result) { this.state = { ...this.state, playing: false, error: "No authorized playable source" }; throw new Error(this.state.error); }
    await this.host.load(result.track, result.asset);
    this.state = { ...this.state, queueIndex: Math.max(0, this.state.queue.findIndex((item) => item.id === result.track.id)), resolvedAssetId: result.asset.id };
    return result;
  }
  async play(): Promise<void> { await this.host.play(); this.state = { ...this.state, playing: true }; }
  async pause(): Promise<void> { await this.host.pause(); this.state = { ...this.state, playing: false }; }
  async seek(positionMs: number): Promise<void> { await this.host.seek(positionMs); this.state = { ...this.state, positionMs: Math.max(0, positionMs) }; }
  private userId(): string { const value = (this.state as MusicControllerState & { userId?: string }).userId; if (!value) throw new Error("PlaybackSession requires a userId"); return value; }
}
