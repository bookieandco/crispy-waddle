import { describe, expect, it } from 'vitest';
import type { MediaSessionState } from '../casting';
import type { ResolvedPlaybackSource } from '../playback-resolver';
import { createBrowserAirPlayController } from './browser-airplay';

function playback(titleId = 'title-a', url = 'https://media.example/a.m3u8'): ResolvedPlaybackSource {
  return {
    providerId: 'provider-a',
    source: { id: 'source-a', titleId, kind: 'hls', url },
    capabilities: ['playback', 'seek'],
  };
}

function state(): MediaSessionState {
  return { titleId: 'title-a', kind: 'movie', sourceUrl: 'https://media.example/a.m3u8', positionSeconds: 10, playing: false, volume: 1 };
}

function video() {
  let currentTime = 10;
  let src = 'https://media.example/a.m3u8';
  let paused = true;
  let volume = 1;
  let resolvePlay: (() => void) | null = null;
  const value = {
    get currentTime() { return currentTime; },
    set currentTime(next: number) { currentTime = next; },
    get src() { return src; },
    set src(next: string) { src = next; },
    get paused() { return paused; },
    get volume() { return volume; },
    set volume(next: number) { volume = next; },
    play: () => new Promise<void>((resolve) => { resolvePlay = () => { paused = false; resolve(); }; }),
    pause: () => { paused = true; },
    webkitShowPlaybackTargetPicker: () => undefined,
    resolvePlay: () => resolvePlay?.(),
  } as unknown as HTMLVideoElement & { resolvePlay(): void; webkitShowPlaybackTargetPicker(): void };
  return value;
}

const airplayTarget = { id: 'airplay', name: 'AirPlay TV', transport: 'airplay' } as const;

describe('createBrowserAirPlayController', () => {
  it('rejects stale commands before touching the persistent media element', async () => {
    const media = video();
    let current = false;
    const controller = createBrowserAirPlayController(media, state(), playback(), { isCurrent: () => current });

    await expect(controller.loadPlayback!(playback('title-b'), 25)).rejects.toThrow('JHADINA_MEDIA_ELEMENT_COMMAND_CANCELLED');
    expect(media.src).toBe('https://media.example/a.m3u8');
    expect(media.currentTime).toBe(10);
  });

  it('does not publish a stale async play result after lease loss', async () => {
    const media = video();
    let current = true;
    const controller = createBrowserAirPlayController(media, state(), playback(), { isCurrent: () => current });
    await controller.connect(airplayTarget);

    const command = controller.send({ type: 'play' });
    current = false;
    media.resolvePlay();

    await expect(command).rejects.toThrow('JHADINA_MEDIA_ELEMENT_COMMAND_CANCELLED');
    expect(media.paused).toBe(false);
  });

  it('fences getState after the lease is released', async () => {
    const media = video();
    let current = true;
    const controller = createBrowserAirPlayController(media, state(), playback(), { isCurrent: () => current });
    await controller.connect(airplayTarget);
    current = false;

    await expect(controller.getState()).rejects.toThrow('JHADINA_MEDIA_ELEMENT_COMMAND_CANCELLED');
  });
});
