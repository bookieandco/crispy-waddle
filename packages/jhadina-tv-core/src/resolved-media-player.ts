import type { MediaSessionCommand, MediaSessionState } from './casting';
import type { ResolvedPlaybackSource } from './playback-resolver';

export interface ResolvedPlaybackRuntime {
  getState(): MediaSessionState;
  apply(command: Exclude<MediaSessionCommand, { type: 'transfer' }>): Promise<void>;
  setSource(url: string): void;
  onStateChange?(listener: (state: MediaSessionState) => void): () => void;
  isCurrent?(): boolean;
}

export interface ResolvedMediaPlayer extends ResolvedPlaybackRuntime {
  readonly playback: ResolvedPlaybackSource;
}

function assertResolvedPlayback(playback: ResolvedPlaybackSource, runtime: ResolvedPlaybackRuntime): void {
  if (!playback.providerId) throw new Error('Playback provider is required.');
  if (!playback.source.id || !playback.source.titleId) throw new Error('Playback source is incomplete.');
  if (playback.source.titleId !== runtime.getState().titleId) throw new Error('Playback source title does not match the media session.');
  if (!playback.source.url.startsWith('https://')) throw new Error('Playback source must use HTTPS.');
  if (playback.source.kind === 'external') throw new Error('External playback sources require an external playback executor.');
  for (const subtitle of playback.source.subtitles ?? []) {
    if (!subtitle.url.startsWith('https://')) throw new Error('Playback subtitle source must use HTTPS.');
  }
}

function assertCurrent(runtime: ResolvedPlaybackRuntime): void {
  if (runtime.isCurrent && !runtime.isCurrent()) {
    throw new Error('JHADINA_MEDIA_ELEMENT_COMMAND_CANCELLED');
  }
}

export function createResolvedMediaPlayer(
  playback: ResolvedPlaybackSource,
  runtime: ResolvedPlaybackRuntime,
): ResolvedMediaPlayer {
  assertResolvedPlayback(playback, runtime);
  assertCurrent(runtime);
  runtime.setSource(playback.source.url);
  return {
    ...runtime,
    apply: async (command) => {
      assertCurrent(runtime);
      await runtime.apply(command);
    },
    setSource: (url) => {
      assertCurrent(runtime);
      runtime.setSource(url);
    },
    playback,
  };
}

export function assertNativePlaybackSource(
  playback: ResolvedPlaybackSource,
  runtime: ResolvedPlaybackRuntime,
): void {
  assertResolvedPlayback(playback, runtime);
}
