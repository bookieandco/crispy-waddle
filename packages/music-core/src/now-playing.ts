import type { Lyrics, Track } from "./types.js";

export type NowPlayingState = {
  track: Track | null;
  lyrics: Lyrics | null;
  isOpen: boolean;
  expanded: boolean;
};

export function createNowPlayingState(): NowPlayingState {
  return { track: null, lyrics: null, isOpen: false, expanded: false };
}

export function openNowPlaying(state: NowPlayingState, track: Track, lyrics?: Lyrics | null): NowPlayingState {
  return { ...state, track, lyrics: lyrics ?? null, isOpen: true };
}

export function closeNowPlaying(state: NowPlayingState): NowPlayingState {
  return { ...state, isOpen: false, expanded: false };
}

export function setNowPlayingExpanded(state: NowPlayingState, expanded: boolean): NowPlayingState {
  return { ...state, expanded };
}

export function setNowPlayingLyrics(state: NowPlayingState, lyrics: Lyrics | null): NowPlayingState {
  return { ...state, lyrics };
}
