import type { Track } from "@jhadina/music-core";

export const MUSIC_PLAYER_EVENT = "jhadina:music-player-command";

export type MusicPlayerCommand =
  | { type: "play"; track: Track; sourceUri: string }
  | { type: "queue"; track: Track; sourceUri: string; mode?: "last" | "next" }
  | { type: "pause" }
  | { type: "resume" };

export function dispatchMusicPlayerCommand(command: MusicPlayerCommand) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<MusicPlayerCommand>(MUSIC_PLAYER_EVENT, { detail: command }));
}
