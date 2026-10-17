import { describe, it, expect } from 'vitest';
import { admittedHlsResource, hlsResourceSignature, verifyHlsResourceSignature, rewriteJtvHlsPlaylist, readBoundedHlsManifest } from './hls-proxy';
const stream = new URL('https://my-jellyfin.example/jellyfin/Videos/abc/stream');
const proxy = new URL('https://watch.example/api/jhadinatv/jellyfin/stream?id=abc&mode=vod&token=expiring');
describe('JTV signed HLS manifest rewrites', () => {
  it('signs subresources for this media capability only', () => {
    const sig = hlsResourceSignature('/jellyfin/Videos/abc/part.ts', 'root', 's'.repeat(32));
    expect(verifyHlsResourceSignature('/jellyfin/Videos/abc/part.ts', 'root', sig, 's'.repeat(32))).toBe(true);
    expect(verifyHlsResourceSignature('/jellyfin/Videos/abc/other.ts', 'root', sig, 's'.repeat(32))).toBe(false);
    expect(verifyHlsResourceSignature('/jellyfin/Videos/abc/part.ts', 'other', sig, 's'.repeat(32))).toBe(false);
  });
  it('rewrites media, variant playlists, and AES key URIs without revealing provider credentials', () => {
    const manifest = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="secret.key"\npart000.ts\nvariant.m3u8\n';
    const output = rewriteJtvHlsPlaylist(manifest, stream, stream, proxy, 'expiring', 's'.repeat(32));
    expect(output).toContain('resourceSig=');
    expect(output).not.toContain('https://my-jellyfin.example/');
    expect(output).not.toContain('secret.key"');
    expect(output).toContain('URI="https://watch.example/');
    expect(output).toContain('token=expiring');
  });
  it('blocks off-origin, path escaping, arbitrary remote paths, and malformed manifests', () => {
    for (const value of ['https://evil.example/steal', '../../Users/admin', '/System/Info', 'ftp://evil.example/file']) {
      expect(() => admittedHlsResource(value, stream, stream)).toThrow();
    }
    expect(() => rewriteJtvHlsPlaylist('https://evil.example/x', stream, stream, proxy, 't', 's'.repeat(32))).toThrow();
  });
});

describe('JTV-LIVE HLS upstream resource bounds', () => {
  it('reads bounded UTF-8 chunked manifests', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) { ctrl.enqueue(encoder.encode('#EXTM3U\n')); ctrl.enqueue(encoder.encode('segment.ts\n')); ctrl.close(); },
    });
    expect(await readBoundedHlsManifest(body, 100)).toBe('#EXTM3U\nsegment.ts\n');
  });
  it('rejects over-limit manifests and malformed UTF-8', async () => {
    const oversize = new ReadableStream<Uint8Array>({
      start(ctrl) { ctrl.enqueue(new Uint8Array(101)); ctrl.close(); },
    });
    await expect(readBoundedHlsManifest(oversize, 100)).rejects.toThrow(/safety limit/);
    const bad = new ReadableStream<Uint8Array>({
      start(ctrl) { ctrl.enqueue(new Uint8Array([0xff, 0xfe])); ctrl.close(); },
    });
    await expect(readBoundedHlsManifest(bad)).rejects.toThrow();
  });
  it('denies double-encoded traversal and secret-bearing segment references', () => {
    for (const ref of [
      '%252e%252e/Admin', '%252fAdmin', 'segment.ts?api_key=do-not-expose',
      'segment.ts?access_token=do-not-expose', 'segment.ts?authorization=do-not-expose',
    ]) expect(() => admittedHlsResource(ref, stream, stream)).toThrow();
  });
});
