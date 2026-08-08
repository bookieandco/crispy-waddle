import type { CaptionMode, PlaybackControlsState } from './playback-controls'

export interface PlayerUIAction {
  id: 'rewind' | 'play-pause' | 'fast-forward' | 'captions' | 'translation'
  label: string
  enabled: boolean
}

export function buildPlayerUIActions(state: PlaybackControlsState): PlayerUIAction[] {
  return [
    { id: 'rewind', label: 'Rewind 10 seconds', enabled: state.positionSeconds > 0 },
    { id: 'play-pause', label: state.isPlaying ? 'Pause' : 'Play', enabled: true },
    { id: 'fast-forward', label: 'Fast-forward 10 seconds', enabled: state.durationSeconds === undefined || state.positionSeconds < state.durationSeconds },
    { id: 'captions', label: state.captionMode === ('off' satisfies CaptionMode) ? 'Turn captions on' : 'Turn captions off', enabled: state.availableTracks.some((track) => track.kind === 'caption' || track.kind === 'subtitle') },
    { id: 'translation', label: state.translationLanguage ? `Translation: ${state.translationLanguage}` : 'Choose translation', enabled: state.availableTracks.some((track) => track.kind === 'translated') },
  ]
}
