import type { GamePlatform } from './runtime.js';
import type { GameSourceRecord } from './game-source.js';
import type { RemoteApp } from './remote-apps.js';

export interface RemoteAppDiscovery {
  list(host: { id: string; address: string; port?: number }): Promise<readonly RemoteApp[]>;
}

export interface RemoteAppSourceAdapter {
  readonly source: 'moonlight';
  discover(host: { id: string; address: string; port?: number }): Promise<readonly GameSourceRecord[]>;
}

export class MoonlightAppSourceAdapter implements RemoteAppSourceAdapter {
  readonly source = 'moonlight' as const;

  constructor(private readonly discovery: RemoteAppDiscovery) {}

  async discover(host: { id: string; address: string; port?: number }): Promise<readonly GameSourceRecord[]> {
    const apps = await this.discovery.list(host);
    return apps.map((app) => ({
      sourceId: `${host.id}:${app.id}`,
      source: 'moonlight',
      title: app.name,
      platform: (app.platform ?? 'pc') as GamePlatform,
      contentUri: app.launchTarget,
      hostId: host.id,
      metadata: { hostAddress: host.address, hostPort: String(host.port ?? 0), kind: app.kind },
    }));
  }
}
