import type { MediaAsset, Track } from "./types.js";
import type { PlaybackHost, PlaybackHostState } from "./playback-host.js";

export interface BrowserPlaybackHostOptions {
  audio?: HTMLAudioElement;
  onEnded?: () => void | Promise<void>;
  onStateChange?: (state: PlaybackHostState) => void;
}

/** Browser-only audio host. Authorization and asset resolution remain in PlaybackSession. */
export class BrowserPlaybackHost implements PlaybackHost {
  private readonly audio: HTMLAudioElement;
  private readonly onEnded?: () => void | Promise<void>;
  private readonly onStateChange?: (state: PlaybackHostState) => void;
  private state: PlaybackHostState = { playing: false };

  constructor(options: BrowserPlaybackHostOptions = {}) {
    if (typeof window === "undefined") throw new Error("BrowserPlaybackHost requires a browser");
    this.audio = options.audio ?? new Audio();
    this.onEnded = options.onEnded;
    this.onStateChange = options.onStateChange;
    this.audio.preload = "auto";
    this.audio.addEventListener("play", () => this.emit({ ...this.state, playing: true }));
    this.audio.addEventListener("pause", () => this.emit({ ...this.state, playing: false }));
    this.audio.addEventListener("ended", () => void this.onEnded?.());
    this.audio.addEventListener("timeupdate", () => this.onStateChange?.({ ...this.state, playing: !this.audio.paused }));
    this.installMediaSession();
  }

  async load(track: Track, asset: MediaAsset): Promise<void> {
    if (!asset.uri) throw new Error("Playable media asset has no URI");
    this.audio.src = asset.uri;
    this.audio.currentTime = 0;
    this.state = { track, asset, playing: false };
    this.updateMediaSession(track);
    this.emit(this.state);
  }

  async play(): Promise<void> {
    if (!this.state.asset) throw new Error("No media asset loaded");
    await this.audio.play();
    this.emit({ ...this.state, playing: true });
  }

  async pause(): Promise<void> { this.audio.pause(); this.emit({ ...this.state, playing: false }); }
  async seek(positionMs: number): Promise<void> { if (!this.state.asset) throw new Error("No media asset loaded"); this.audio.currentTime = Math.max(0, positionMs) / 1000; }
  getState(): PlaybackHostState { return this.state; }
  private emit(state: PlaybackHostState): void { this.state = state; this.onStateChange?.(state); }

  private installMediaSession(): void {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => void this.play());
    navigator.mediaSession.setActionHandler("pause", () => void this.pause());
    navigator.mediaSession.setActionHandler("seekbackward", (d) => void this.seek((this.audio.currentTime - (d.seekOffset ?? 10)) * 1000));
    navigator.mediaSession.setActionHandler("seekforward", (d) => void this.seek((this.audio.currentTime + (d.seekOffset ?? 10)) * 1000));
  }

  private updateMediaSession(track: Track): void {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artistIds.join(", ") });
  }
}
