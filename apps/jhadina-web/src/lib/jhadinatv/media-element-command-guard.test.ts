import { describe, expect, it, vi } from 'vitest';
import type { LocalPlaybackAdapter, MediaSessionState } from '@jhadina/tv-core';
import { acquireMediaElementEventLease } from './media-element-event-owner';
import { createGuardedLocalPlaybackAdapter, MEDIA_ELEMENT_COMMAND_CANCELLED } from './media-element-command-guard';

function state(): MediaSessionState {
  return { titleId: 'a', kind: 'movie', sourceUrl: 'https://example.com/a.m3u8', positionSeconds: 0, durationSeconds: 60, playing: false, volume: 1, target: { id: 'local', name: 'This device', transport: 'local' } };
}

function adapter(overrides: Partial<LocalPlaybackAdapter> = {}): LocalPlaybackAdapter {
  return { getState: () => state(), apply: vi.fn(async () => undefined), setSource: vi.fn(), onStateChange: vi.fn(() => () => undefined), ...overrides };
}

describe('createGuardedLocalPlaybackAdapter', () => {
  it('rejects commands from a stale lease before touching the adapter', async () => {
    const a = acquireMediaElementEventLease();
    const local = adapter();
    const guarded = createGuardedLocalPlaybackAdapter(local, a);
    const b = acquireMediaElementEventLease();

    await expect(guarded.apply({ type: 'pause' })).rejects.toThrow(MEDIA_ELEMENT_COMMAND_CANCELLED);
    expect(local.apply).not.toHaveBeenCalled();
    b.release();
  });

  it('rejects a command when ownership changes while async playback is in flight', async () => {
    const a = acquireMediaElementEventLease();
    const deferred = new Promise<void>((resolve) => setTimeout(resolve, 0));
    const local = adapter({ apply: vi.fn(async () => deferred) });
    const guarded = createGuardedLocalPlaybackAdapter(local, a);
    const pending = guarded.apply({ type: 'play' });
    const b = acquireMediaElementEventLease();

    await expect(pending).rejects.toThrow(MEDIA_ELEMENT_COMMAND_CANCELLED);
    expect(local.apply).toHaveBeenCalledTimes(1);
    b.release();
  });

  it('fences source replacement when ownership is stale', () => {
    const a = acquireMediaElementEventLease();
    const local = adapter();
    const guarded = createGuardedLocalPlaybackAdapter(local, a);
    const b = acquireMediaElementEventLease();

    expect(() => guarded.setSource('https://example.com/b.m3u8')).toThrow(MEDIA_ELEMENT_COMMAND_CANCELLED);
    expect(local.setSource).not.toHaveBeenCalled();
    b.release();
  });

  it('only forwards state events while the lease is current', () => {
    const a = acquireMediaElementEventLease();
    let emit: ((next: MediaSessionState) => void) | undefined;
    const listener = vi.fn();
    const local = adapter({ onStateChange: (next) => { emit = next; return () => undefined; } });
    createGuardedLocalPlaybackAdapter(local, a).onStateChange?.(listener);
    emit?.(state());
    expect(listener).toHaveBeenCalledTimes(1);

    const b = acquireMediaElementEventLease();
    emit?.(state());
    expect(listener).toHaveBeenCalledTimes(1);
    b.release();
  });
});
