import { describe, expect, it } from 'vitest';
import { GameBoyRuntimeHostAdapter, type GameBoyEmulatorInstance } from './gameboy-runtime-host.js';

function fakeEmulator() {
  const calls: string[] = [];
  const instance: GameBoyEmulatorInstance = {
    setInput: () => calls.push('input'), start: async () => { calls.push('start'); },
    pause: async () => { calls.push('pause'); }, resume: async () => { calls.push('resume'); },
    stop: async () => { calls.push('stop'); },
  };
  return { instance, calls };
}

describe('GameBoyRuntimeHostAdapter', () => {
  it('creates and starts an emulator session', async () => {
    const fake = fakeEmulator();
    const host = new GameBoyRuntimeHostAdapter({ create: async () => fake.instance });
    const result = await host.launch('rom://test.gb', {});
    expect(result.sessionId).toMatch(/^gb-/);
    expect(fake.calls).toEqual(['start']);
    expect(host.get(result.sessionId)).toBe(fake.instance);
  });

  it('stops and removes a session', async () => {
    const fake = fakeEmulator();
    const host = new GameBoyRuntimeHostAdapter({ create: async () => fake.instance });
    const { sessionId } = await host.launch('rom://test.gb', {});
    await host.stop(sessionId);
    expect(fake.calls).toEqual(['start', 'stop']);
    expect(host.get(sessionId)).toBeUndefined();
  });
});
