import type { Track } from "./types.js";
import { createMusicControllerState, next, playTrack, previous } from "./music-controller.js";
import type { AuthorizedPlaybackResolver } from "./user-scoped-playback-resolver.js";
import { PlaybackSession } from "./playback-session.js";
import type { PlaybackHost } from "./playback-host.js";

/** Backward-compatible adapter: the PlaybackSession owns the single playback state. */
export class JhadinaMusicPlaybackAdapter {
  readonly session: PlaybackSession;

  constructor(userId: string, resolver: AuthorizedPlaybackResolver, host: PlaybackHost, initial = createMusicControllerState()) {
    this.session = new PlaybackSession(userId, resolver, host, initial);
  }

  getState() { return this.session.getState(); }

  async play(track?: Track): Promise<void> {
    if (track) this.session.transition((state) => playTrack(state, track));
    else this.session.transition((state) => ({ ...state, playing: true }));
    const current = this.session.getState().queue[this.session.getState().queueIndex];
    if (current) await this.session.load(current);
    await this.session.play();
  }

  async pause(): Promise<void> { await this.session.pause(); }

  async next(): Promise<void> {
    this.session.transition(next);
    const state = this.session.getState();
    const current = state.queue[state.queueIndex];
    if (current && state.playing) { await this.session.load(current); await this.session.play(); }
    else await this.session.pause();
  }

  async previous(): Promise<void> {
    this.session.transition(previous);
    const state = this.session.getState();
    const current = state.queue[state.queueIndex];
    if (current && state.playing) { await this.session.load(current); await this.session.play(); }
    else await this.session.pause();
  }

  async seek(positionMs: number): Promise<void> { await this.session.seek(positionMs); }
}
