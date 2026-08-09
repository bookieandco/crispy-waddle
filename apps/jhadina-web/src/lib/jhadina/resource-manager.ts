export type ResourceKind = 'compute' | 'worker' | 'storage' | 'service';
export type ResourceState = 'desired' | 'provisioning' | 'running' | 'paused' | 'failed' | 'destroyed';

export type JhadinaResource = {
  id: string;
  name: string;
  kind: ResourceKind;
  state: ResourceState;
  provider?: string;
  metadata?: Record<string, unknown>;
};

export interface JhadinaResourceManager {
  provision(spec: Omit<JhadinaResource, 'state'>): Promise<JhadinaResource>;
  scale(id: string, metadata: Record<string, unknown>): Promise<JhadinaResource>;
  pause(id: string): Promise<JhadinaResource>;
  resume(id: string): Promise<JhadinaResource>;
  destroy(id: string): Promise<JhadinaResource>;
  status(id: string): Promise<JhadinaResource | null>;
}

/**
 * Safe application-level contract. Infrastructure providers such as
 * Harvester/Crossplane can implement this later; the web app does not talk
 * to a cluster or cloud API directly.
 */
export class UnconfiguredResourceManager implements JhadinaResourceManager {
  async provision(spec: Omit<JhadinaResource, 'state'>) {
    return { ...spec, state: 'desired' as const };
  }
  async scale(id: string, metadata: Record<string, unknown>) {
    return { id, name: id, kind: 'compute' as const, state: 'desired' as const, metadata };
  }
  async pause(id: string) { return { id, name: id, kind: 'compute' as const, state: 'paused' as const }; }
  async resume(id: string) { return { id, name: id, kind: 'compute' as const, state: 'desired' as const }; }
  async destroy(id: string) { return { id, name: id, kind: 'compute' as const, state: 'destroyed' as const }; }
  async status(_id: string) { return null; }
}
