import { afterEach, describe, expect, it, vi } from 'vitest';
import { jellyfinAssetIsAccessible, jtvEvidenceFingerprint } from './jellyfin-access';

const config = {
  serverUrl: 'https://media.example.test', apiKey: 'private', userId: 'configured-user',
  rightsEvidenceIds: ['contract-b', 'contract-a'],
};

afterEach(() => vi.unstubAllGlobals());

describe('Jellyfin exact-asset entitlement', () => {
  it('uses the configured user and requires the exact VOD asset identity', async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ Id: 'item-1', Name: 'Authorized title' }),
    });
    vi.stubGlobal('fetch', mock);
    expect(await jellyfinAssetIsAccessible(config, 'item-1', 'vod')).toBe(true);
    const request = mock.mock.calls[0];
    expect(String(request[0])).toContain('/Users/configured-user/Items/item-1');
    expect(request[1].headers['X-Emby-Token']).toBe('private');
    expect(request[1].redirect).toBe('error');
    expect(await jellyfinAssetIsAccessible(config, 'item-2', 'vod')).toBe(false);
  });

  it('checks live channel membership and fails closed on provider errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ Items: [{ Id: 'live-1' }, { Id: 'live-2' }] }),
    }));
    expect(await jellyfinAssetIsAccessible(config, 'live-2', 'live')).toBe(true);
    expect(await jellyfinAssetIsAccessible(config, 'live-3', 'live')).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('provider offline')));
    expect(await jellyfinAssetIsAccessible(config, 'live-1', 'live')).toBe(false);
    expect(await jellyfinAssetIsAccessible(config, '../../secret', 'vod')).toBe(false);
  });

  it('binds capabilities to current rights evidence without order dependence', () => {
    expect(jtvEvidenceFingerprint(['b', 'a'])).toBe(jtvEvidenceFingerprint(['a', 'b']));
    expect(jtvEvidenceFingerprint(['a'])).not.toBe(jtvEvidenceFingerprint(['b']));
  });
});
