import type { MediaAsset, Track } from "./types.js";

export type PlaybackHostState = { track?: Track; asset?: MediaAsset; playing: boolean };

export interface PlaybackHost {
  load(track: Track, asset: MediaAsset): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  getState(): PlaybackHostState;
}

/** Platform-neutral adapter. Web/native layers own the actual audio element/player. */
export class MemoryPlaybackHost implements PlaybackHost {
  private state: PlaybackHostState = { playing: false };
  async load(track: Track, asset: MediaAsset) { this.state = { track, asset, playing: false }; }
  async play() { if (!this.state.asset) throw new Error("No media asset loaded"); this.state = { ...this.state, playing: true }; }
  async pause() { this.state = { ...this.state, playing: false }; }
  async seek(_positionMs: number) { if (!this.state.asset) throw new Error("No media asset loaded"); }
  getState() { return this.state; }
}
