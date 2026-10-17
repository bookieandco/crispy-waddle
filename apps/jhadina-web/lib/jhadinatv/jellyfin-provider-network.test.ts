import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJellyfinProviderBundle, getJellyfinAdmissionStatus } from './jellyfin-provider';

describe('JTV-LIVE Jellyfin catalog credential boundary', () => {
  beforeEach(() => {
    process.env.JHADINA_TV_JELLYFIN_URL = 'https://private-media.example.test/jellyfin';
    process.env.JHADINA_TV_JELLYFIN_API_KEY = 'provider-only-test-token';
    process.env.JHADINA_TV_JELLYFIN_USER_ID = 'test-user';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS = 'playback';
    process.env.JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS = 'test-rights-evidence';
    process.env.JHADINA_PUBLIC_ORIGIN = 'https://jtv.example.test';
  });
  afterEach(() => {
    for (const key of [
      'JHADINA_TV_JELLYFIN_URL', 'JHADINA_TV_JELLYFIN_API_KEY',
      'JHADINA_TV_JELLYFIN_USER_ID', 'JHADINA_TV_JELLYFIN_RIGHTS',
      'JHADINA_TV_JELLYFIN_RIGHTS_EVIDENCE_IDS', 'JHADINA_PUBLIC_ORIGIN',
    ]) delete process.env[key];
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requires HTTPS before catalog admission', () => {
    process.env.JHADINA_TV_JELLYFIN_URL = 'http://untrusted.example.test';
    expect(getJellyfinAdmissionStatus().admitted).toBe(false);
    expect(createJellyfinProviderBundle()).toBeNull();
  });

  it('rejects upstream HTTP redirects without forwarding catalog credentials', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue({ ok: false, status: 302 });
    vi.stubGlobal('fetch', fetchUpstream);
    const bundle = createJellyfinProviderBundle();
    expect(bundle).not.toBeNull();
    await expect(bundle!.catalogClient.search('example')).rejects.toThrow('Jellyfin request failed');
    expect(fetchUpstream).toHaveBeenCalledTimes(1);
    const [url, init] = fetchUpstream.mock.calls[0];
    expect(String(url)).toContain('/jellyfin/Items?');
    expect(init.redirect).toBe('error');
    expect(init.cache).toBe('no-store');
    expect(init.headers['X-Emby-Token']).toBe('provider-only-test-token');
    expect(init.signal).toBeDefined();
  });
  it('returns movies and series as browse entries, never orphan episodes', async () => {
    const records = [
      { Id: 'movie-1', Name: 'First Movie', Type: 'Movie' },
      { Id: 'series-1', Name: 'First Series', Type: 'Series' },
      { Id: 'episode-1', Name: 'Orphan Episode', Type: 'Episode' },
    ];
    const fetchUpstream = vi.fn(async (url: string) => ({
      ok: true, status: 200, json: async () => (
        String(url).includes('/LiveTv/Channels') ? { Items: [] } : { Items: records }
      ),
    }));
    vi.stubGlobal('fetch', fetchUpstream);
    const bundle = createJellyfinProviderBundle();
    expect(bundle).not.toBeNull();
    const titles = await bundle!.catalogClient.search('');
    expect(titles.map(item => item.id)).toEqual(['jellyfin:movie-1', 'jellyfin:series-1']);
    const catalogUrl = String(fetchUpstream.mock.calls[0]?.[0]);
    expect(catalogUrl).toContain('IncludeItemTypes=Movie%2CSeries');
    expect(catalogUrl).not.toContain('Episode');
  });
  it('resolves an authorized standalone episode as a playable TV item', async () => {
    const fetchUpstream = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ Id: 'episode-1', Name: 'Episode', Type: 'Episode' }),
    });
    vi.stubGlobal('fetch', fetchUpstream);
    const { getAuthorizedJellyfinTitle } = await import('./jellyfin-provider');
    const episode = await getAuthorizedJellyfinTitle('jellyfin:episode-1', 'tv');
    expect(episode?.id).toBe('jellyfin:episode-1');
    expect(episode?.kind).toBe('tv');
  });

});
