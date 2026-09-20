import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { createNodeFfmpegDecoder } from './ffmpeg-process-adapter.js';

describe('createNodeFfmpegDecoder', () => {
  it('creates a decoder with injectable process execution', () => {
    const calls: string[][] = [];
    const decoder = createNodeFfmpegDecoder((args) => {
      calls.push(args);
      throw new Error('test process');
    });

    expect(decoder).toBeDefined();
    expect(decoder.decodeFrames({ source: 'sample.mp4', assetId: 'asset-1' })).toBeDefined();
    expect(calls).toEqual([]);
  });

  it('reassembles JPEG frames across arbitrary stdout chunk boundaries', async () => {
    const child:any = new EventEmitter();
    child.stdout = new Readable({ read() {} });
    child.stderr = new Readable({ read() {} });
    child.killed = false;
    child.kill = () => { child.killed = true; return true; };

    const decoder = createNodeFfmpegDecoder(() => child);
    const iterator = decoder.decodeFrames({
      source: 'sample.mp4',
      assetId: 'asset-1',
      frameRate: 2,
    })[Symbol.asyncIterator]();

    const firstPending = iterator.next();
    child.stdout.push(Buffer.from([0xff, 0xd8, 0x01]));
    child.stdout.push(Buffer.from([0x02, 0xff]));
    child.stdout.push(Buffer.from([0xd9, 0xff, 0xd8, 0x03, 0xff, 0xd9]));
    child.stdout.push(null);
    child.emit('close', 0);

    const first = await firstPending;
    const second = await iterator.next();
    const done = await iterator.next();

    expect(first.value?.timestampSeconds).toBe(0);
    expect(second.value?.timestampSeconds).toBe(0.5);
    expect(first.value?.frameRef.endsWith(Buffer.from([0xff,0xd8,0x01,0x02,0xff,0xd9]).toString('base64'))).toBe(true);
    expect(second.value?.frameRef.endsWith(Buffer.from([0xff,0xd8,0x03,0xff,0xd9]).toString('base64'))).toBe(true);
    expect(done.done).toBe(true);
  });

  it('passes a bounded end time to ffmpeg', async () => {
    const child:any = new EventEmitter();
    child.stdout = Readable.from([]);
    child.stderr = new Readable({ read() {} });
    child.killed = false;
    child.kill = () => true;
    let args:string[] = [];
    const decoder = createNodeFfmpegDecoder((value) => { args = value; queueMicrotask(() => child.emit('close', 0)); return child; });

    for await (const _ of decoder.decodeFrames({
      source: 'sample.mp4',
      assetId: 'asset-1',
      startSeconds: 10,
      endSeconds: 15,
    })) void _;

    const durationIndex = args.indexOf('-t');
    expect(durationIndex).toBeGreaterThan(-1);
    expect(args[durationIndex + 1]).toBe('5');
  });
});
