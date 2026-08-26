import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createNodeFfmpegDecoder } from './ffmpeg-process-adapter.js';

type FakeChild = EventEmitter & { stdout: Readable; stderr: Readable; killed: boolean; kill: (signal?: NodeJS.Signals) => boolean };

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new Readable({ read() {} });
  child.stderr = new Readable({ read() {} });
  child.killed = false;
  child.kill = (signal) => {
    child.killed = true;
    if (signal === 'SIGTERM') queueMicrotask(() => child.emit('close', 143));
    return true;
  };
  return child;
}

describe('FFmpeg cancellation', () => {
  it('terminates the spawned process when the decode signal aborts', async () => {
    const child = fakeChild();
    const decoder = createNodeFfmpegDecoder(() => child as never);
    const controller = new AbortController();
    const iterator = decoder.decodeFrames({ source: 'sample.mp4', assetId: 'asset-1', signal: controller.signal })[Symbol.asyncIterator]();

    const pending = iterator.next();
    controller.abort();
    child.stdout.push(null);

    await pending.catch(() => undefined);
    expect(child.killed).toBe(true);
  });
});
