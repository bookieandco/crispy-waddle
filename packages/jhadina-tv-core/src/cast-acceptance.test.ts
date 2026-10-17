import { describe, expect, it, vi } from 'vitest';
import { createGoogleCastController, type GoogleCastRuntime } from './cast/google-cast';
import type { MediaSessionState } from './casting';

const state: MediaSessionState = {
  titleId: 'jellyfin:movie-1', kind: 'movie',
  sourceUrl: 'https://tv.example/api/jhadinatv/jellyfin/stream?id=movie-1',
  positionSeconds: 30, playing: true,
};
const target = { id: 'google-cast', name: 'Chromecast', transport: 'google-cast' as const };

describe('JTV-LIVE.ACCEPT.04 Cast availability', () => {
  it('does not advertise an opaque or unauthorized stream as castable', async () => {
    const requestSession = vi.fn();
    const runtime: GoogleCastRuntime = {
      isSupported: () => true, canLoadSource: () => false, requestSession,
    };
    const controller = createGoogleCastController(runtime, state);
    expect(await controller.discoverTargets()).toEqual([]);
    await expect(controller.connect(target)).rejects.toThrow(/verified media format/);
    expect(requestSession).not.toHaveBeenCalled();
  });

  it('does not create a receiver session when Cast SDK is unavailable', async () => {
    const requestSession = vi.fn();
    const controller = createGoogleCastController({
      isSupported: () => false, canLoadSource: () => true, requestSession,
    }, state);
    expect(await controller.discoverTargets()).toEqual([]);
    await expect(controller.connect(target)).rejects.toThrow(/not available/);
    expect(requestSession).not.toHaveBeenCalled();
  });
});
