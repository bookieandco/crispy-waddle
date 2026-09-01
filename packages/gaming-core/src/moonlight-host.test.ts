import { describe, expect, it } from 'vitest';
import { InMemoryMoonlightHostRegistry } from './moonlight-host.js';

describe('InMemoryMoonlightHostRegistry', () => {
  it('registers and lists hosts', () => {
    const registry = new InMemoryMoonlightHostRegistry();
    registry.upsert({ id: 'homebase', name: 'Jhadina Homebase', address: '192.168.1.10', paired: false });
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('homebase')?.name).toBe('Jhadina Homebase');
  });

  it('marks a discovered host as paired', () => {
    const registry = new InMemoryMoonlightHostRegistry();
    registry.upsert({ id: 'homebase', name: 'Jhadina Homebase', address: '192.168.1.10', paired: false });
    expect(registry.markPaired('homebase').paired).toBe(true);
  });

  it('rejects malformed hosts', () => {
    const registry = new InMemoryMoonlightHostRegistry();
    expect(() => registry.upsert({ id: '', name: 'Homebase', address: '192.168.1.10', paired: false })).toThrow();
    expect(() => registry.upsert({ id: 'homebase', name: 'Homebase', address: '', paired: false })).toThrow();
  });
});
