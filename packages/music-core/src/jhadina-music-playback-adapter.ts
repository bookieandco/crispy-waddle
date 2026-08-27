import type { Track } from "./types.js";
import { createMusicControllerState, next, playTrack, previous, type MusicControllerState } from "./music-controller.js";
import type { AuthorizedPlaybackResolver } from "./user-scoped-playback-resolver.js";
import { PlaybackSession } from "./playback-session.js";
import type { PlaybackHost } from "./playback-host.js";

/** Backward-compatible adapter: legacy queue functions and resolved playback share one state model. */
export class JhadinaMusicPlaybackAdapter {
  private state: MusicControllerState;
  readonly session: PlaybackSession;

  constructor(
    userId: string,
    resolver: AuthorizedPlaybackResolver,
    host: PlaybackHost,
    initial: MusicControllerState = createMusicControllerState(),
  ) {
    this.state = initial;
    this.session = new PlaybackSession(userId, resolver, host, initial);
  }

  getState(): MusicControllerState { return this.state; }

  async play(track?: Track): Promise<void> {
    if (track) this.state = playTrack(this.state, track);
    else this.state = { ...this.state, playing: true };
    const current = this.state.queue[this.state.queueIndex];
    if (current) await this.session.load(current);
    await this.session.play();
    this.state = this.session.getState();
  }

  async pause(): Promise<void> { await this.session.pause(); this.state = this.session.getState(); }

  async next(): Promise<void> {
    this.state = next(this.state);
    const current = this.state.queue[this.state.queueIndex];
    if (current && this.state.playing) { await this.session.load(current); await this.session.play(); }
    else await this.session.pause();
    this.state = this.session.getState();
  }

  async previous(): Promise<void> {
    this.state = previous(this.state);
    const current = this.state.queue[this.state.queueIndex];
    if (current && this.state.playing) { await this.session.load(current); await this.session.play(); }
    else await this.session.pause();
    this.state = this.session.getState();
  }

  async seek(positionMs: number): Promise<void> { await this.session.seek(positionMs); this.state = this.session.getState(); }
}
