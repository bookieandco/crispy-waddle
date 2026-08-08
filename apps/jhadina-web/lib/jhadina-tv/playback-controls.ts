export type CaptionMode = 'off' | 'captions' | 'subtitles'

export interface TranslationTrack {
  id: string
  language: string
  label: string
  kind: 'subtitle' | 'caption' | 'translated'
}

export interface PlaybackControlsState {
  isPlaying: boolean
  positionSeconds: number
  durationSeconds?: number
  volume: number
  captionMode: CaptionMode
  captionLanguage?: string
  translationLanguage?: string
  availableTracks: TranslationTrack[]
}

export const DEFAULT_SKIP_SECONDS = 10

export function seekRelative(state: PlaybackControlsState, deltaSeconds: number): PlaybackControlsState {
  const max = state.durationSeconds ?? Number.POSITIVE_INFINITY
  const position = Math.max(0, Math.min(max, state.positionSeconds + deltaSeconds))
  return { ...state, positionSeconds: position }
}

export function rewind(state: PlaybackControlsState, seconds = DEFAULT_SKIP_SECONDS): PlaybackControlsState {
  return seekRelative(state, -Math.abs(seconds))
}

export function fastForward(state: PlaybackControlsState, seconds = DEFAULT_SKIP_SECONDS): PlaybackControlsState {
  return seekRelative(state, Math.abs(seconds))
}

export function togglePause(state: PlaybackControlsState): PlaybackControlsState {
  return { ...state, isPlaying: !state.isPlaying }
}

export function setCaptionMode(state: PlaybackControlsState, mode: CaptionMode, language?: string): PlaybackControlsState {
  return { ...state, captionMode: mode, captionLanguage: mode === 'off' ? undefined : language ?? state.captionLanguage }
}

export function setTranslationLanguage(state: PlaybackControlsState, language?: string): PlaybackControlsState {
  return { ...state, translationLanguage: language }
}
