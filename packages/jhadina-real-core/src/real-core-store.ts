import type { RealState } from './real-state.js';

/** Persistence boundary for continuity state. Implementations must be authoritative per continuityKey. */
export interface RealCoreStore {
  load(continuityKey: string): Promise<RealState | undefined>;
  save(state: RealState): Promise<void>;
}

/** Useful for tests and single-process development; production should provide durable storage. */
export class InMemoryRealCoreStore implements RealCoreStore {
  private readonly states = new Map<string, RealState>();

  async load(continuityKey: string): Promise<RealState | undefined> {
    const state = this.states.get(continuityKey);
    return state ? structuredClone(state) : undefined;
  }

  async save(state: RealState): Promise<void> {
    this.states.set(state.identity.continuityKey, structuredClone(state));
  }
}
