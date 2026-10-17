import { describe, expect, it, vi } from 'vitest';
import { createUnifiedMediaSession } from './media-session';
import type { CastingManager, MediaSessionState, PlaybackTarget } from './casting';

const localTarget: PlaybackTarget = { id: 'local', name: 'Device', transport: 'local' };
const remoteTarget: PlaybackTarget = { id: 'cast', name: 'TV', transport: 'google-cast' };
const initial: MediaSessionState = {
  titleId: 'jellyfin:one', kind: 'movie', sourceUrl: 'https://tv.example/one',
  target: localTarget, positionSeconds: 10, playing: false,
};

function fixtures(overrides: Partial<CastingManager> = {}) {
  let notify: ((next: MediaSessionState) => void) | undefined;
  const removeLocal = vi.fn();
  const stopRemote = vi.fn();
  const disconnect = vi.fn(async () => undefined);
  const adapter = {
    getState: () => initial,
    apply: vi.fn(async () => undefined),
    onStateChange: vi.fn((callback: (state: MediaSessionState) => void) => {
      notify = callback;
      return removeLocal;
    }),
  };
  const casting: CastingManager = {
    discover: vi.fn(async () => [remoteTarget]),
    connect: vi.fn(async () => undefined),
    disconnect,
    send: vi.fn(async () => undefined),
    getState: vi.fn(async () => ({ ...initial, target: remoteTarget })),
    subscribeState: vi.fn(() => stopRemote),
    ...overrides,
  };
  const session = createUnifiedMediaSession({
    titleId: initial.titleId, kind: initial.kind, sourceUrl: initial.sourceUrl,
    local: adapter, casting,
  });
  return { session, adapter, casting, removeLocal, stopRemote, disconnect,
    emitLocal: (value: MediaSessionState) => notify?.(value) };
}

describe('JTV-PLAYBACK.05 media session lifecycle', () => {
  it('unsubscribes local element listeners on renewal, idempotently', async () => {
    const f = fixtures();
    const observer = vi.fn();
    f.session.subscribe(observer);
    f.emitLocal({ ...initial, positionSeconds: 20 });
    expect(observer).toHaveBeenCalledTimes(1);
    await f.session.dispose();
    await f.session.dispose();
    expect(f.removeLocal).toHaveBeenCalledTimes(1);
    expect(f.disconnect).not.toHaveBeenCalled();
    f.emitLocal({ ...initial, positionSeconds: 30 });
    expect(observer).toHaveBeenCalledTimes(1);
    await expect(f.session.play()).rejects.toThrow(/disposed/);
    await expect(f.session.discoverTargets()).rejects.toThrow(/disposed/);
  });

  it('clears remote polling and disconnects on navigation without local autoplay', async () => {
    const f = fixtures();
    await f.session.transfer(remoteTarget);
    expect(f.casting.subscribeState).toHaveBeenCalledTimes(1);
    await f.session.dispose();
    expect(f.stopRemote).toHaveBeenCalledTimes(1);
    expect(f.removeLocal).toHaveBeenCalledTimes(1);
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    expect(f.adapter.apply).not.toHaveBeenCalled();
  });

  it('does not reactivate an in-flight Cast transfer after unmount', async () => {
    let complete!: () => void;
    const started = new Promise<void>(resolve => { complete = resolve; });
    const f = fixtures({ connect: vi.fn(() => started) });
    const pending = f.session.transfer(remoteTarget);
    await f.session.dispose();
    complete();
    await pending;
    expect(f.casting.subscribeState).not.toHaveBeenCalled();
    expect(f.disconnect).toHaveBeenCalledTimes(1);
  });

  it('disconnects on failed transfer command instead of retaining a receiver', async () => {
    const f = fixtures({ send: vi.fn().mockRejectedValue(Error('receiver offline')) });
    await expect(f.session.transfer(remoteTarget)).rejects.toThrow('receiver offline');
    expect(f.disconnect).toHaveBeenCalledTimes(1);
    await f.session.dispose();
  });
});
