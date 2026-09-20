import type { MediaAsset, Track } from "./types.js";
import type { PlaybackHost, PlaybackHostState } from "./playback-host.js";
export interface BrowserPlaybackHostOptions { audio?: HTMLAudioElement; onEnded?: () => void | Promise<void>; onStateChange?: (state: PlaybackHostState) => void; }
export class BrowserPlaybackHost implements PlaybackHost {
  private readonly audio: HTMLAudioElement; private state: PlaybackHostState = { playing:false, positionMs:0 };
  constructor(private readonly options: BrowserPlaybackHostOptions = {}) {
    if (typeof window === "undefined") throw new Error("BrowserPlaybackHost requires a browser");
    this.audio=options.audio ?? new Audio(); this.audio.preload="auto";
    this.audio.addEventListener("play",()=>this.emit({...this.state,playing:true}));
    this.audio.addEventListener("pause",()=>this.emit({...this.state,playing:false}));
    this.audio.addEventListener("ended",()=>void options.onEnded?.());
    this.audio.addEventListener("timeupdate",()=>this.emit({...this.state,positionMs:Math.round(this.audio.currentTime*1000),playing:!this.audio.paused}));
  }
  async load(track:Track,asset:MediaAsset){if(!asset.uri)throw new Error("Playable media asset has no URI");this.audio.src=asset.uri;this.audio.currentTime=0;this.emit({track,asset,playing:false,positionMs:0});}
  async play(){if(!this.state.asset)throw new Error("No media asset loaded");await this.audio.play();}
  async pause(){this.audio.pause();}
  async seek(ms:number){if(!this.state.asset)throw new Error("No media asset loaded");this.audio.currentTime=Math.max(0,ms)/1000;this.emit({...this.state,positionMs:Math.max(0,ms)});}
  getState(){return this.state;} private emit(state:PlaybackHostState){this.state=state;this.options.onStateChange?.(state);}
}
