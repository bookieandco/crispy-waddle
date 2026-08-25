import type { AudioOutputDevice, MusicSource, Track } from "./types.js";

export type RepeatMode = "off" | "all" | "one";

export interface MusicControllerState {
  queue: Track[];
  queueIndex: number;
  playing: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  positionMs: number;
  volume: number;
  activeSourceId?: string;
  activeOutput?: AudioOutputDevice;
  offlineOnly: boolean;
}

export interface MusicControllerSnapshot extends MusicControllerState {
  currentTrack?: Track;
  upNext: Track[];
}

export function createMusicControllerState(): MusicControllerState {
  return {
    queue: [],
    queueIndex: -1,
    playing: false,
    shuffle: false,
    repeat: "off",
    positionMs: 0,
    volume: 1,
    offlineOnly: false,
  };
}

export function snapshot(state: MusicControllerState): MusicControllerSnapshot {
  const currentTrack = state.queue[state.queueIndex];
  return {
    ...state,
    currentTrack,
    upNext: state.queue.slice(Math.max(0, state.queueIndex + 1)),
  };
}

export function enqueue(state: MusicControllerState, tracks: Track[], playFirst = false): MusicControllerState {
  const queue = [...state.queue, ...tracks.filter((track) => !state.queue.some((item) => item.id === track.id))];
  const queueIndex = playFirst && queue.length > 0 ? state.queue.length : state.queueIndex;
  return { ...state, queue, queueIndex, playing: playFirst && queue.length > 0, positionMs: playFirst ? 0 : state.positionMs };
}

export function playTrack(state: MusicControllerState, track: Track): MusicControllerState {
  const existing = state.queue.findIndex((item) => item.id === track.id);
  if (existing >= 0) return { ...state, queueIndex: existing, playing: true, positionMs: 0 };
  return { ...state, queue: [...state.queue, track], queueIndex: state.queue.length, playing: true, positionMs: 0 };
}

export function next(state: MusicControllerState): MusicControllerState {
  if (state.queue.length === 0) return state;
  if (state.repeat === "one") return { ...state, positionMs: 0, playing: true };
  if (state.queueIndex < state.queue.length - 1) return { ...state, queueIndex: state.queueIndex + 1, positionMs: 0, playing: true };
  if (state.repeat === "all") return { ...state, queueIndex: 0, positionMs: 0, playing: true };
  return { ...state, playing: false, positionMs: 0 };
}

export function previous(state: MusicControllerState): MusicControllerState {
  if (state.queue.length === 0) return state;
  if (state.positionMs > 5000) return { ...state, positionMs: 0 };
  const index = Math.max(0, state.queueIndex - 1);
  return { ...state, queueIndex: index, positionMs: 0, playing: true };
}

export function toggleShuffle(state: MusicControllerState): MusicControllerState {
  return { ...state, shuffle: !state.shuffle };
}

export function cycleRepeat(state: MusicControllerState): MusicControllerState {
  const repeat: RepeatMode = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  return { ...state, repeat };
}

export function setOfflineOnly(state: MusicControllerState, enabled: boolean): MusicControllerState {
  return { ...state, offlineOnly: enabled };
}

export function setSource(state: MusicControllerState, source?: MusicSource): MusicControllerState {
  return { ...state, activeSourceId: source?.id };
}

export function setOutput(state: MusicControllerState, output?: AudioOutputDevice): MusicControllerState {
  return { ...state, activeOutput: output };
}

export function setVolume(state: MusicControllerState, volume: number): MusicControllerState {
  return { ...state, volume: Math.min(1, Math.max(0, volume)) };
}
