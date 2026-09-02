import { describe, expect, it, vi } from 'vitest';
import { createMediaPlaybackStore, type MediaQueueItem } from './media-playback-store';

const item = (id: string): MediaQueueItem => ({
  id,
  titleId: id,
  title: id,
  kind: 'movie',
  playback: {
    providerId: 'direct',
    source: { id: `${id}-source`, titleId: id, kind: 'hls', url: `https://media.example/${id}.m3u8` },
    capabilities: ['playback', 'seek'],
  },
});

describe('media playback store', () => {
  it('publishes canonical current item and queue state', () => {
    const store = createMediaPlaybackStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const first = item('one');
    const second = item('two');
    store.setQueue([first, second], 1);
    expect(store.getState().current).toEqual(second);
    expect(store.getState().queueIndex).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setCurrent(first, 0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keeps queue index valid when removing the current item', () => {
    const store = createMediaPlaybackStore();
    const first = item('one');
    const second = item('two');
    const third = item('three');
    store.setQueue([first, second, third], 1);
    store.removeFromQueue('two');
    expect(store.getState().queue.map((entry) => entry.id)).toEqual(['one', 'three']);
    expect(store.getState().queueIndex).toBe(1);
    expect(store.getState().current?.id).toBe('three');
  });

  it('updates repeat and shuffle without changing current playback identity', () => {
    const store = createMediaPlaybackStore();
    const first = item('one');
    store.setCurrent(first);
    store.setRepeat('all');
    store.setShuffle(true);
    expect(store.getState().current?.id).toBe('one');
    expect(store.getState().repeat).toBe('all');
    expect(store.getState().shuffle).toBe(true);
  });

  it('uses a separate shuffle order without mutating canonical queue order', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const store = createMediaPlaybackStore();
    const queue = [item('one'), item('two'), item('three')];
    store.setQueue(queue, 0);
    store.setShuffle(true);

    expect(store.getState().queue.map((entry) => entry.id)).toEqual(['one', 'two', 'three']);
    expect(store.next()?.id).toBe('three');
    expect(store.getState().queue.map((entry) => entry.id)).toEqual(['one', 'two', 'three']);
    vi.restoreAllMocks();
  });

  it('does not immediately repeat the current item when shuffle wraps', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const store = createMediaPlaybackStore();
    const queue = [item('one'), item('two'), item('three')];
    store.setQueue(queue, 0);
    store.setShuffle(true);
    const first = store.next();
    expect(first?.id).not.toBe('one');
    store.next();
    const wrapped = store.next();
    expect(wrapped?.id).not.toBe('one');
    vi.restoreAllMocks();
  });

  it('repeat one wins over shuffle navigation', () => {
    const store = createMediaPlaybackStore();
    const queue = [item('one'), item('two')];
    store.setQueue(queue, 0);
    store.setShuffle(true);
    store.setRepeat('one');
    expect(store.next()?.id).toBe('one');
    expect(store.previous()?.id).toBe('one');
  });

  it('repeat all can continue from a shuffled order', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const store = createMediaPlaybackStore();
    const queue = [item('one'), item('two'), item('three')];
    store.setQueue(queue, 0);
    store.setShuffle(true);
    store.setRepeat('all');
    expect(store.next()?.id).not.toBe('one');
    expect(store.next()).not.toBeNull();
    expect(store.next()).not.toBeNull();
    expect(store.getState().current).not.toBeNull();
    vi.restoreAllMocks();
  });

  it('resets all state to the canonical empty state', () => {
    const store = createMediaPlaybackStore({ queue: [item('one')], queueIndex: 0, current: item('one'), shuffle: true, repeat: 'one' });
    store.reset();
    expect(store.getState()).toEqual({ current: null, queue: [], queueIndex: -1, playerState: null, repeat: 'off', shuffle: false });
  });
});
