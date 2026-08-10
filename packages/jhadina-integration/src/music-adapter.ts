import type { MusicCore, MusicTrack, PlaybackState } from '../../music-core/src/index';
import type { MusicAudioOutput } from '../../music-core/src/audio-output';
import type { ActionAdapter, ExecutionContext } from './action-executor';
import type { DomainId } from './contracts';

export type MusicCoreActionInput =
  | { query: string }
  | { track: MusicTrack }
  | { outputId: string }
  | Record<string, never>;

export function createMusicCoreAdapters(music: MusicCore, audioOutput?: MusicAudioOutput): ActionAdapter[] {
  const run = async (capability: string, input: MusicCoreActionInput): Promise<unknown> => {
    switch (capability) {
      case 'catalog.search': return { results: await music.search((input as { query: string }).query) };
      case 'playback.play': return { playback: await music.play((input as { track: MusicTrack }).track) };
      case 'playback.pause': return { playback: await music.pause() };
      case 'playback.resume': return { playback: await music.resume() };
      case 'playback.next': return { playback: await music.next() };
      case 'playback.previous': return { playback: await music.previous() };
      case 'playback.status': return { playback: await music.getPlaybackState() };
      case 'audio.outputs':
        if (!audioOutput) throw new Error('Audio output bridge unavailable');
        return { outputs: await audioOutput.devices() };
      case 'audio.select-output':
        if (!audioOutput) throw new Error('Audio output bridge unavailable');
        return { output: await audioOutput.select((input as { outputId: string }).outputId) };
      default: throw new Error(`Unsupported MusicOS capability: ${capability}`);
    }
  };

  return [
    'catalog.search', 'playback.play', 'playback.pause', 'playback.resume',
    'playback.next', 'playback.previous', 'playback.status', 'audio.outputs', 'audio.select-output',
  ].map((capability) => ({
    domain: 'musicos' as DomainId,
    capability,
    execute: (input: MusicCoreActionInput, _context: ExecutionContext) => run(capability, input),
  }));
}
