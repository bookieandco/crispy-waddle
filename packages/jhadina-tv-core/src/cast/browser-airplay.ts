import type { MediaSessionController, MediaSessionState, PlaybackTarget } from '../casting';
import type { ResolvedPlaybackSource } from '../playback-resolver';
import { assertCastablePlayback } from './execution';
export type AirPlayVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };

export function createBrowserAirPlayController(video: AirPlayVideo, initialState: MediaSessionState, initialPlayback: ResolvedPlaybackSource): MediaSessionController {
  assertCastablePlayback(initialPlayback);
  const target: PlaybackTarget = { id: 'airplay', name: 'AirPlay TV', transport: 'airplay' };
  let connected = false;
  let state = initialState;
  let playback = initialPlayback;
  const supported = () => typeof video.webkitShowPlaybackTargetPicker === 'function';
  return {
    transport: 'airplay',
    async discoverTargets() { return supported() ? [target] : []; },
    async connect(nextTarget) {
      if (nextTarget.transport !== 'airplay') throw new Error('AirPlay controller requires an airplay target.');
      if (!supported()) throw new Error('AirPlay is not available in this browser.');
      assertCastablePlayback(playback);
      video.webkitShowPlaybackTargetPicker!();
      connected = true;
      state = { ...state, titleId: playback.source.titleId, sourceUrl: playback.source.url, target: nextTarget };
    },
    async disconnect() { connected = false; state = { ...state, target: undefined }; },
    async loadPlayback(nextPlayback, positionSeconds = 0) {
      assertCastablePlayback(nextPlayback);
      if (!connected) throw new Error('AirPlay is not connected.');
      video.src = nextPlayback.source.url;
      video.currentTime = Math.max(0, positionSeconds);
      playback = nextPlayback;
      state = { ...state, titleId: nextPlayback.source.titleId, sourceUrl: nextPlayback.source.url, positionSeconds: Math.max(0, positionSeconds), playing: false };
    },
    async send(command) {
      if (command.type === 'transfer' && command.target) { await this.connect(command.target); return; }
      if (!connected) throw new Error('AirPlay is not connected.');
      if (command.type === 'play') await video.play();
      else if (command.type === 'pause') video.pause();
      else if (command.type === 'seek' && typeof command.value === 'number') video.currentTime = command.value;
      else if (command.type === 'set-volume' && typeof command.value === 'number') video.volume = Math.max(0, Math.min(1, command.value));
      state = { ...state, positionSeconds: video.currentTime, playing: !video.paused };
    },
    async getState() { return connected ? { ...state, positionSeconds: video.currentTime, playing: !video.paused } : state; },
  };
}
