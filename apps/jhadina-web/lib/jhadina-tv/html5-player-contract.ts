export interface HTML5PlayerPort {
  play(): Promise<void>
  pause(): void
  seek(seconds: number): void
  setVolume(volume: number): void
  setCaptionTrack(trackId: string | null): void
  setPlaybackRate(rate: number): void
}

export interface PlayerSnapshot {
  playing: boolean
  currentTime: number
  duration: number
  volume: number
  captionTrackId: string | null
  playbackRate: number
}

export const PLAYER_SKIP_SECONDS = 10

export function applySeek(player: HTML5PlayerPort, currentTime: number, delta: number): void {
  player.seek(Math.max(0, currentTime + delta))
}

export function togglePlayback(player: HTML5PlayerPort, playing: boolean): Promise<void> {
  if (playing) {
    player.pause()
    return Promise.resolve()
  }
  return player.play()
}
