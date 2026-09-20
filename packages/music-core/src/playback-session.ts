import type { Track } from "./types.js";
import type { AuthorizedPlaybackResolver, UserPlaybackResult } from "./user-scoped-playback-resolver.js";
import type { PlaybackHost } from "./playback-host.js";

export interface PlaybackSessionState {
  track?: Track;
  queue: Track[];
  queueIndex: number;
  playing: boolean;
  positionMs: number;
  offlineOnly: boolean;
  resolvedAssetId?: string;
  error?: string;
}
export class PlaybackSession {
  private state: PlaybackSessionState;
  constructor(private readonly userId: string, private readonly resolver: AuthorizedPlaybackResolver, private readonly host: PlaybackHost, initial: Partial<PlaybackSessionState> = {}) {
    if (!userId) throw new Error("PlaybackSession requires a userId");
    this.state = { queue: [], queueIndex: -1, playing: false, positionMs: 0, offlineOnly: false, ...initial };
  }
  getUserId() { return this.userId; }
  getState(): PlaybackSessionState { return this.state; }
  async load(track: Track): Promise<UserPlaybackResult> {
    this.state = { ...this.state, error: undefined };
    const result = await this.resolver.resolve({ userId: this.userId, track, offlineOnly: this.state.offlineOnly });
    if (!result) { this.state = { ...this.state, playing: false, error: "No authorized playable source" }; throw new Error(this.state.error); }
    await this.host.load(result.track, result.asset);
    const queueIndex = this.state.queue.findIndex((item) => item.id === result.track.id);
    this.state = { ...this.state, track: result.track, positionMs: 0, queueIndex: queueIndex >= 0 ? queueIndex : this.state.queueIndex, resolvedAssetId: result.asset.id };
    return result;
  }
  async play() { await this.host.play(); this.state = { ...this.state, playing: true }; }
  async pause() { await this.host.pause(); this.state = { ...this.state, playing: false }; }
  async seek(positionMs: number) { const next = Math.max(0, positionMs); await this.host.seek(next); this.state = { ...this.state, positionMs: next }; }
}
