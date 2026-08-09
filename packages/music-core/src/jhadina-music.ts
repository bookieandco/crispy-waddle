import type { MusicCore, MusicTrack, PlaybackState } from "./index";

export type MusicAction =
  | { type: "music.search"; query: string }
  | { type: "music.play"; track: MusicTrack }
  | { type: "music.pause" }
  | { type: "music.resume" }
  | { type: "music.next" }
  | { type: "music.previous" }
  | { type: "music.status" };

export type MusicActionResult = {
  results?: MusicTrack[];
  playback?: PlaybackState;
};

/**
 * Narrow capability boundary between Jhadina reasoning and Music Core.
 * The reasoning layer can request explicit music operations only.
 */
export class JhadinaMusicCapability {
  constructor(private readonly music: MusicCore) {}

  async execute(action: MusicAction): Promise<MusicActionResult> {
    switch (action.type) {
      case "music.search":
        return { results: await this.music.search(action.query) };
      case "music.play":
        return { playback: await this.music.play(action.track) };
      case "music.pause":
        return { playback: await this.music.pause() };
      case "music.resume":
        return { playback: await this.music.resume() };
      case "music.next":
        return { playback: await this.music.next() };
      case "music.previous":
        return { playback: await this.music.previous() };
      case "music.status":
        return { playback: await this.music.getPlaybackState() };
    }
  }
}
