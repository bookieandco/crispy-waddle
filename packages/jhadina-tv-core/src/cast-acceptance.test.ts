import { describe, expect, it, vi } from 'vitest';
import { createGoogleCastController, type GoogleCastRuntime } from './cast/google-cast';
import { createBrowserAirPlayController, type AirPlayVideo } from './cast/browser-airplay';
import type { MediaSessionState } from './casting';
import { createJhadinaTVReceiverController } from './cast/jhadinatv-receiver';

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

  it('closes a receiver after failed media load and retains no remote session', async () => {
    const end = vi.fn(async () => undefined);
    const runtime: GoogleCastRuntime = {
      isSupported: () => true, canLoadSource: () => true,
      requestSession: vi.fn(async () => ({
        loadMedia: vi.fn(async () => { throw new Error('unsupported receiver format'); }),
        end,
        send: vi.fn(async () => undefined),
        getState: vi.fn(async () => null),
      })),
    };
    const controller = createGoogleCastController(runtime, state);
    await expect(controller.connect(target)).rejects.toThrow('unsupported receiver format');
    expect(end).toHaveBeenCalledTimes(1);
    await expect(controller.send({ type: 'play' })).rejects.toThrow(/not connected/);
    expect((await controller.getState())?.target).toBeUndefined();
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

describe('JTV-LIVE.ACCEPT.04 AirPlay confirmation', () => {
  it('does not mark cancelled or unconfirmed picker as connected', async () => {
    vi.useFakeTimers();
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    const video = {
      webkitCurrentPlaybackTargetIsWireless: false,
      webkitShowPlaybackTargetPicker: vi.fn(),
      addEventListener: vi.fn((event: string, cb: EventListenerOrEventListenerObject) => listeners.set(event, cb)),
      removeEventListener: vi.fn((event: string) => listeners.delete(event)),
      currentTime: 0, paused: true,
    } as unknown as AirPlayVideo;
    const controller = createBrowserAirPlayController(video, state);
    const pending = controller.connect({ id: 'airplay', name: 'AirPlay TV', transport: 'airplay' });
    const assertion = expect(pending).rejects.toThrow(/not confirmed/);
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect((await controller.getState())?.target).toBeUndefined();
    vi.useRealTimers();
  });
  it('opens AirPlay picker exactly once during unified transfer and no duplicate during send', async () => {
    const picker = vi.fn();
    const video = {
      webkitCurrentPlaybackTargetIsWireless: true,
      webkitShowPlaybackTargetPicker: picker,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      currentTime: 18, paused: true, volume: 1,
    } as unknown as AirPlayVideo;
    const controller = createBrowserAirPlayController(video, state);
    const receiver = { id: 'airplay', name: 'AirPlay TV', transport: 'airplay' as const };
    await controller.connect(receiver);
    await controller.send({ type: 'transfer', target: receiver });
    expect(picker).toHaveBeenCalledTimes(1);
    await controller.disconnect();
    await expect(controller.send({ type: 'play' })).rejects.toThrow(/not connected/);
  });

  it('accepts AirPlay only after the wireless target is confirmed', async () => {
    const video = {
      webkitCurrentPlaybackTargetIsWireless: true,
      webkitShowPlaybackTargetPicker: vi.fn(),
      currentTime: 0, paused: true,
    } as unknown as AirPlayVideo;
    const controller = createBrowserAirPlayController(video, state);
    await controller.connect({ id: 'airplay', name: 'AirPlay TV', transport: 'airplay' });
    expect((await controller.getState())?.target?.transport).toBe('airplay');
  });
});


describe('JTV-PLAYBACK.07 — JhadinaTV receiver load cleanup', () => {
  it('disconnects an authenticated socket if receiver media load fails', async () => {
    const disconnect = vi.fn(async () => undefined);
    const transport = {
      discover: vi.fn(async () => []),
      connect: vi.fn(async () => undefined),
      load: vi.fn(async () => { throw new Error('signed media rejected'); }),
      disconnect,
      send: vi.fn(async () => undefined),
      state: vi.fn(async () => null),
    };
    const controller = createJhadinaTVReceiverController(transport, state);
    const receiver = { id: 'owner-tv', name: 'Bedroom TV', transport: 'jhadinatv-tv' as const };
    await expect(controller.connect(receiver)).rejects.toThrow('signed media rejected');
    expect(disconnect).toHaveBeenCalledTimes(1);
    await expect(controller.send({ type: 'play' })).rejects.toThrow(/not connected/);
    expect((await controller.getState())?.target).toBeUndefined();
  });
});
