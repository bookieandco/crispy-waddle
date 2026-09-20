import { describe, expect, it } from 'vitest';
import { GameBoyRuntimeAdapter } from './gameboy-runtime.js';
import type { Game } from './runtime.js';

describe('GameBoyRuntimeAdapter', () => {
  const host = { launch: async () => ({ sessionId: 'session-1' }) };
  const adapter = new GameBoyRuntimeAdapter(host);
  const game: Game = { id: 'gb-1', title: 'Test Game', platform: 'gameboy', contentUri: 'rom://test.gb' };

  it('accepts Game Boy content', async () => {
    expect(await adapter.canLaunch(game)).toBe(true);
  });

  it('rejects other platforms', async () => {
    expect(await adapter.canLaunch({ ...game, platform: 'ps5' })).toBe(false);
  });

  it('launches through the host boundary', async () => {
    const session = await adapter.launch(game, {});
    expect(session).toMatchObject({ id: 'session-1', gameId: 'gb-1', runtimeId: 'gameboy-wasm' });
  });
});
