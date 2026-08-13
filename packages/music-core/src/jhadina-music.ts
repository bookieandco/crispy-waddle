import type { Track } from "./types.js";
import type { PlaybackState } from "./player.js";
import type { AudioOutputDevice, MusicAudioOutput } from "./audio-output.js";

export type MusicTrack = Track;

/** Capability contract consumed by Jhadina without depending on the package barrel. */
export interface MusicCore {
  search(query: string): Promise<MusicTrack[]>;
  play(track: MusicTrack): Promise<PlaybackState>;
  pause(): Promise<PlaybackState>;
  resume(): Promise<PlaybackState>;
  next(): Promise<PlaybackState>;
  previous(): Promise<PlaybackState>;
  getPlaybackState(): Promise<PlaybackState>;
}

export type MusicAction =
  | { type: "music.search"; query: string }
  | { type: "music.play"; track: MusicTrack }
  | { type: "music.pause" }
  | { type: "music.resume" }
  | { type: "music.next" }
  | { type: "music.previous" }
  | { type: "music.status" }
  | { type: "music.outputs" }
  | { type: "music.select-output"; outputId: string };

export type MusicActionResult = {
  results?: MusicTrack[];
  playback?: PlaybackState;
  outputs?: AudioOutputDevice[];
  output?: AudioOutputDevice;
};

export class JhadinaMusicCapability {
  constructor(
    private readonly music: MusicCore,
    private readonly audioOutput?: MusicAudioOutput,
  ) {}

  async execute(action: MusicAction): Promise<MusicActionResult> {
    switch (action.type) {
      case "music.search": return { results: await this.music.search(action.query) };
      case "music.play": return { playback: await this.music.play(action.track) };
      case "music.pause": return { playback: await this.music.pause() };
      case "music.resume": return { playback: await this.music.resume() };
      case "music.next": return { playback: await this.music.next() };
      case "music.previous": return { playback: await this.music.previous() };
      case "music.status": return { playback: await this.music.getPlaybackState() };
      case "music.outputs":
        if (!this.audioOutput) throw new Error("Audio output bridge unavailable");
        return { outputs: await this.audioOutput.devices() };
      case "music.select-output":
        if (!this.audioOutput) throw new Error("Audio output bridge unavailable");
        return { output: await this.audioOutput.select(action.outputId) };
    }
  }
}
