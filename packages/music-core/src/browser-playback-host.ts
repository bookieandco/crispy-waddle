import type { Track } from "./types.js";
import { createPlaybackState, nextTrack, playTrack, previousTrack, type PlaybackState } from "./player.js";

export interface BrowserPlaybackHostOptions {
  audio?: HTMLAudioElement;
  onStateChange?: (state: PlaybackState) => void;
}

/** Browser-only audio host. Music Core stays independent of DOM APIs. */
export class BrowserPlaybackHost {
  private readonly audio: HTMLAudioElement;
  private readonly onStateChange?: (state: PlaybackState) => void;
  private state: PlaybackState = createPlaybackState();

  constructor(options: BrowserPlaybackHostOptions = {}) {
    if (typeof window === "undefined") throw new Error("BrowserPlaybackHost requires a browser");
    this.audio = options.audio ?? new Audio();
    this.onStateChange = options.onStateChange;
    this.audio.addEventListener("timeupdate", () => this.emit({ ...this.state, positionMs: this.audio.currentTime * 1000 }));
    this.audio.addEventListener("play", () => this.emit({ ...this.state, playing: true }));
    this.audio.addEventListener("pause", () => this.emit({ ...this.state, playing: false }));
    this.audio.addEventListener("ended", () => void this.advance());
    this.installMediaSession();
  }

  getState(): PlaybackState { return this.state; }

  async play(track: Track): Promise<PlaybackState> {
    this.state = playTrack(this.state, track);
    if (!track.sourceUrl) throw new Error("Track has no authorized playback source");
    this.audio.src = track.sourceUrl;
    await this.audio.play();
    this.updateMediaSession(track);
    return this.emit(this.state);
  }

  async pause(): Promise<PlaybackState> { this.audio.pause(); return this.emit({ ...this.state, playing: false }); }
  async resume(): Promise<PlaybackState> { await this.audio.play(); return this.emit({ ...this.state, playing: true }); }
  async next(): Promise<PlaybackState> { return this.advance(); }

  async previous(): Promise<PlaybackState> {
    this.state = previousTrack({ ...this.state, positionMs: this.audio.currentTime * 1000 });
    const track = this.state.queue[this.state.queueIndex];
    if (track?.sourceUrl) { this.audio.src = track.sourceUrl; await this.audio.play(); this.updateMediaSession(track); }
    return this.emit(this.state);
  }

  private async advance(): Promise<PlaybackState> {
    this.state = nextTrack(this.state);
    const track = this.state.queue[this.state.queueIndex];
    if (track?.sourceUrl && this.state.playing) { this.audio.src = track.sourceUrl; await this.audio.play(); this.updateMediaSession(track); }
    return this.emit(this.state);
  }

  private emit(state: PlaybackState): PlaybackState { this.state = state; this.onStateChange?.(state); return state; }

  private installMediaSession() {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => void this.resume());
    navigator.mediaSession.setActionHandler("pause", () => void this.pause());
    navigator.mediaSession.setActionHandler("nexttrack", () => void this.next());
    navigator.mediaSession.setActionHandler("previoustrack", () => void this.previous());
  }

  private updateMediaSession(track: Track) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: track.album, artwork: track.artworkUrl ? [{ src: track.artworkUrl }] : [] });
  }
}
