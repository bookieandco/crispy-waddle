import { describe, expect, it } from 'vitest';
import { admittedCastMedia } from './google-cast-runtime';

describe('JTV-LIVE.ACCEPT.04 verified Cast media format', () => {
  it('classifies known direct HLS and MP4 URLs', () => {
    const hls = admittedCastMedia('https://licensed.example/playlist.m3u8');
    expect(hls.contentType).toBe('application/x-mpegURL');
    expect(hls.streamType).toBe('LIVE');
    expect(admittedCastMedia('https://licensed.example/film.mp4').contentType).toBe('video/mp4');
  });
  it('refuses unknown signed Jellyfin proxy, HTTP and misleading URL extensions', () => {
    for (const url of [
      'https://tv.example/api/jhadinatv/jellyfin/stream?id=1',
      'http://tv.example/movie.mp4',
      'https://tv.example/file.m3u8.bad',
    ]) expect(() => admittedCastMedia(url)).toThrow();
  });
});
