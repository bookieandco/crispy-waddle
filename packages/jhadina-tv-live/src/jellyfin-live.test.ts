import { describe, expect, it } from 'vitest';
import { JellyfinLiveTVProvider } from './jellyfin-live';

describe('Jellyfin Live TV provider', () => {
  it('maps channels and programs into vendor-neutral contracts', async () => {
    const provider = new JellyfinLiveTVProvider({
      serverUrl: 'https://jellyfin.example',
      userId: 'user-1',
      client: {
        async getLiveTvChannels() {
          return { Items: [{ Id: 'ch-1', Name: 'Local News', ChannelType: 'TvChannel', ImageTags: { Primary: 'tag' } }] };
        },
        async getLiveTvPrograms() {
          return { Items: [{ Id: 'prog-1', ChannelId: 'ch-1', Name: 'Morning News', Overview: 'Headlines', StartDate: '2026-08-24T13:00:00Z', EndDate: '2026-08-24T14:00:00Z' }] };
        },
      },
    });

    expect(await provider.listChannels()).toEqual([expect.objectContaining({ id: 'jellyfin:ch-1', kind: 'broadcast', provenance: 'jellyfin' })]);
    expect(await provider.getPrograms('jellyfin:ch-1')).toEqual([expect.objectContaining({ channelId: 'jellyfin:ch-1', title: 'Morning News' })]);
  });
});
