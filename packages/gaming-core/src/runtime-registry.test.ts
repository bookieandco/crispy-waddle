import { describe, expect, it } from 'vitest';
import { InMemoryRuntimeRegistry, type GameRuntime } from './runtime-registry.js';

describe('InMemoryRuntimeRegistry', () => {
  const gameboy: GameRuntime = { id: 'gameboy-wasm', name: 'Game Boy WASM Runtime', kind: 'emulator', platforms: ['gameboy'] };

  it('registers and resolves runtimes by platform', () => {
    const registry = new InMemoryRuntimeRegistry();
    registry.register(gameboy);
    expect(registry.resolve('gameboy')).toEqual([gameboy]);
    expect(registry.resolve('ps5')).toEqual([]);
  });

  it('replaces a runtime with the same id', () => {
    const registry = new InMemoryRuntimeRegistry();
    registry.register(gameboy);
    registry.register({ ...gameboy, name: 'Updated Game Boy Runtime' });
    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]?.name).toBe('Updated Game Boy Runtime');
  });

  it('removes a runtime', () => {
    const registry = new InMemoryRuntimeRegistry();
    registry.register(gameboy);
    registry.unregister(gameboy.id);
    expect(registry.list()).toEqual([]);
  });

  it('rejects incomplete runtime definitions', () => {
    const registry = new InMemoryRuntimeRegistry();
    expect(() => registry.register({ ...gameboy, id: '' })).toThrow();
    expect(() => registry.register({ ...gameboy, name: '' })).toThrow();
    expect(() => registry.register({ ...gameboy, platforms: [] })).toThrow();
  });
});
