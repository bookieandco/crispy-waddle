export interface MoonlightHost {
  id: string;
  name: string;
  address: string;
  port?: number;
  paired: boolean;
}

export interface MoonlightHostDiscovery {
  discover(): Promise<readonly MoonlightHost[]>;
}

export interface MoonlightPairingService {
  pair(host: MoonlightHost, pin: string): Promise<MoonlightHost>;
  unpair(hostId: string): Promise<void>;
}

export class InMemoryMoonlightHostRegistry {
  private readonly hosts = new Map<string, MoonlightHost>();

  upsert(host: MoonlightHost): void {
    if (!host.id.trim()) throw new Error('Moonlight host id is required');
    if (!host.address.trim()) throw new Error('Moonlight host address is required');
    this.hosts.set(host.id, Object.freeze({ ...host }));
  }

  get(hostId: string): MoonlightHost | undefined { return this.hosts.get(hostId); }
  list(): readonly MoonlightHost[] { return [...this.hosts.values()]; }

  markPaired(hostId: string): MoonlightHost {
    const host = this.hosts.get(hostId);
    if (!host) throw new Error(`Moonlight host not found: ${hostId}`);
    const paired = Object.freeze({ ...host, paired: true });
    this.hosts.set(hostId, paired);
    return paired;
  }
}
