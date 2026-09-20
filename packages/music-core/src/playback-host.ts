import type { MediaAsset, Track } from "./types.js";
export type PlaybackHostState = { track?: Track; asset?: MediaAsset; playing: boolean; positionMs: number };
export interface PlaybackHost {
  load(track: Track, asset: MediaAsset): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  getState(): PlaybackHostState;
}
export class MemoryPlaybackHost implements PlaybackHost {
  private state: PlaybackHostState = { playing: false, positionMs: 0 };
  async load(track: Track, asset: MediaAsset) { this.state = { track, asset, playing: false, positionMs: 0 }; }
  async play() { if (!this.state.asset) throw new Error("No media asset loaded"); this.state = { ...this.state, playing: true }; }
  async pause() { this.state = { ...this.state, playing: false }; }
  async seek(positionMs: number) { if (!this.state.asset) throw new Error("No media asset loaded"); this.state = { ...this.state, positionMs: Math.max(0, positionMs) }; }
  getState() { return this.state; }
}
