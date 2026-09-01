import { describe, expect, it } from 'vitest';
import { MoonlightAppSourceAdapter } from './moonlight-apps.js';

describe('MoonlightAppSourceAdapter', () => {
  it('converts discovered apps into canonical game sources', async () => {
    const adapter = new MoonlightAppSourceAdapter({ list: async () => [{ id: 'steam', hostId: 'homebase', name: 'Steam', kind: 'application', launchTarget: 'steam://open/main' }] });
    const [game] = await adapter.discover({ id: 'homebase', address: '192.168.1.20', port: 47989 });
    expect(game).toMatchObject({ sourceId: 'homebase:steam', source: 'moonlight', title: 'Steam', platform: 'pc', contentUri: 'steam://open/main', hostId: 'homebase' });
  });
});
