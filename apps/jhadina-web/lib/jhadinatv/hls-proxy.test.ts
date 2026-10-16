import { describe, it, expect } from 'vitest';
import { admittedHlsResource, hlsResourceSignature, verifyHlsResourceSignature, rewriteJtvHlsPlaylist } from './hls-proxy';
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
