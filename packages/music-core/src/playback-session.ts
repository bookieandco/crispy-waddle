import type { Track } from "./types.js";
import type { MusicControllerState } from "./music-controller.js";
import type { AuthorizedPlaybackResolver, UserPlaybackResult } from "./user-scoped-playback-resolver.js";
import type { PlaybackHost } from "./playback-host.js";

export type PlaybackSessionState = MusicControllerState & { resolvedAssetId?: string; error?: string };
export type PlaybackStateTransition = (state: MusicControllerState) => MusicControllerState;

/** Orchestrates one authenticated user's playback and owns the single playback state. */
export class PlaybackSession {
  private state: PlaybackSessionState;
  constructor(private readonly userId: string, private readonly resolver: AuthorizedPlaybackResolver, private readonly host: PlaybackHost, initial: MusicControllerState) {
    if (!userId) throw new Error("PlaybackSession requires a userId");
    this.state = { ...initial };
  }
  getUserId(): string { return this.userId; }
  getState(): PlaybackSessionState { return this.state; }
  transition(fn: PlaybackStateTransition): PlaybackSessionState { this.state = { ...this.state, ...fn(this.state) }; return this.state; }
  async load(track: Track): Promise<UserPlaybackResult> {
    this.state = { ...this.state, error: undefined };
    const result = await this.resolver.resolve({ userId: this.userId, track, offlineOnly: this.state.offlineOnly });
    if (!result) { this.state = { ...this.state, playing: false, error: "No authorized playable source" }; throw new Error(this.state.error); }
    await this.host.load(result.track, result.asset);
    const queueIndex = this.state.queue.findIndex((item) => item.id === result.track.id);
    this.state = { ...this.state, queueIndex: queueIndex >= 0 ? queueIndex : this.state.queueIndex, resolvedAssetId: result.asset.id };
    return result;
  }
  async play(): Promise<void> { await this.host.play(); this.state = { ...this.state, playing: true }; }
  async pause(): Promise<void> { await this.host.pause(); this.state = { ...this.state, playing: false }; }
  async seek(positionMs: number): Promise<void> { const next = Math.max(0, positionMs); await this.host.seek(next); this.state = { ...this.state, positionMs: next }; }
}
