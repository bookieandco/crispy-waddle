export type RemoteAppKind = 'game' | 'emulator' | 'desktop' | 'application';

export interface RemoteApp {
  id: string;
  hostId: string;
  name: string;
  kind: RemoteAppKind;
  launchTarget: string;
  iconUri?: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface RemoteAppCatalog {
  list(hostId: string): Promise<readonly RemoteApp[]>;
}

export class InMemoryRemoteAppCatalog implements RemoteAppCatalog {
  private readonly apps = new Map<string, RemoteApp>();

  upsert(app: RemoteApp): void {
    if (!app.id.trim()) throw new Error('Remote app id is required');
    if (!app.hostId.trim()) throw new Error('Remote host id is required');
    if (!app.name.trim()) throw new Error('Remote app name is required');
    if (!app.launchTarget.trim()) throw new Error('Remote launch target is required');
    this.apps.set(app.id, Object.freeze({ ...app, metadata: app.metadata ? { ...app.metadata } : undefined }));
  }

  async list(hostId: string): Promise<readonly RemoteApp[]> {
    return [...this.apps.values()].filter((app) => app.hostId === hostId);
  }
}
