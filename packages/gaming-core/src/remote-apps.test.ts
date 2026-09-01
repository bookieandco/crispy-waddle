import { describe, expect, it } from 'vitest';
import { InMemoryRemoteAppCatalog } from './remote-apps.js';

describe('InMemoryRemoteAppCatalog', () => {
  it('lists applications belonging to a host', async () => {
    const catalog = new InMemoryRemoteAppCatalog();
    catalog.upsert({ id: 'steam', hostId: 'homebase', name: 'Steam', kind: 'application', launchTarget: 'steam://open/main' });
    catalog.upsert({ id: 'other', hostId: 'other-host', name: 'Other', kind: 'application', launchTarget: 'other://app' });
    expect(await catalog.list('homebase')).toHaveLength(1);
    expect((await catalog.list('homebase'))[0]?.name).toBe('Steam');
  });

  it('rejects malformed remote apps', () => {
    const catalog = new InMemoryRemoteAppCatalog();
    expect(() => catalog.upsert({ id: '', hostId: 'homebase', name: 'Steam', kind: 'application', launchTarget: 'steam://open/main' })).toThrow();
    expect(() => catalog.upsert({ id: 'steam', hostId: 'homebase', name: '', kind: 'application', launchTarget: 'steam://open/main' })).toThrow();
  });
});
