import { describe, expect, it } from 'vitest';
import { playbackFailureHint, renewalDelayMs, restoredVodPosition, signedStreamExpiryMs } from './playback-recovery';

function signedLikeUrl(expiresAt: number) {
  const payload = btoa(JSON.stringify({ v: 1, expiresAt })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return 'https://tv.example/api/jhadinatv/jellyfin/stream?id=item-1&mode=vod&token=' +
    payload + '.' + 'a'.repeat(43);
}

describe('JTV-PLAYBACK.01–.04 renewal hints never replace server admission', () => {
  it('requests renewal five minutes before one-hour signed expiry', () => {
    const now = 1_800_000_000_000;
    const url = signedLikeUrl(now / 1000 + 3600);
    expect(signedStreamExpiryMs(url)).toBe(now + 3600000);
    expect(renewalDelayMs(url, now)).toBe(55 * 60000);
    expect(renewalDelayMs(url, now + 58 * 60000)).toBe(0);
  });
  it('does not parse non-JhadinaTV URLs, malformed claims or untrusted local HTTP', () => {
    for (const url of [
      'https://evil.example/stream?token=opaque', 'http://tv.example/api/jhadinatv/jellyfin/stream?token=abc',
      'https://tv.example/api/jhadinatv/jellyfin/stream?token=notjwt',
      'https://tv.example/api/jhadinatv/jellyfin/stream?token=AA.AA',
    ]) {
      expect(signedStreamExpiryMs(url)).toBeNull();
      expect(renewalDelayMs(url)).toBeNull();
    }
  });
  it('retains a safe time offset for VOD without seeking past finite duration', () => {
    expect(restoredVodPosition(87, 180)).toBe(87);
    expect(restoredVodPosition(180, 180)).toBe(179);
    expect(restoredVodPosition(Number.NaN, 120)).toBeNull();
    expect(restoredVodPosition(0, 180)).toBeNull();
  });
  it('shows actionable network and Safari format errors without claiming credentials', () => {
    expect(playbackFailureHint(2)).toMatch(/connection/);
    expect(playbackFailureHint(3)).toMatch(/decode/);
    expect(playbackFailureHint(4)).toMatch(/iPhone/);
    expect(playbackFailureHint(undefined)).toMatch(/Retry/);
  });
});
