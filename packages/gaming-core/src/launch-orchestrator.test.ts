import { describe, expect, it } from 'vitest';
import { InMemoryGameLibrary } from './game-library.js';
import { UnifiedGameLaunchOrchestrator } from './launch-orchestrator.js';

describe('UnifiedGameLaunchOrchestrator', () => {
  const game = { id: 'steam:123', title: 'Portal', platform: 'pc' as const, contentUri: 'steam://run/400' };
  const runtime = {
    runtime: { id: 'moonlight', name: 'Moonlight', platform: 'pc' as const, kind: 'streaming' as const, capabilities: ['remote-video'] },
    canLaunch: async () => true,
    launch: async () => ({ id: 'session-1', gameId: game.id, runtimeId: 'moonlight', startedAt: '2026-08-31T00:00:00.000Z' }),
  };

  it('resolves and launches a game through one interface', async () => {
    const library = new InMemoryGameLibrary();
    await library.save(game);
    const orchestrator = new UnifiedGameLaunchOrchestrator(library, { resolve: async () => runtime });
    const result = await orchestrator.launch(game.id);
    expect(result.runtimeId).toBe('moonlight');
    expect(result.session.gameId).toBe(game.id);
  });

  it('fails when the game is missing', async () => {
    const orchestrator = new UnifiedGameLaunchOrchestrator(new InMemoryGameLibrary(), { resolve: async () => runtime });
    await expect(orchestrator.launch('missing')).rejects.toThrow('Game not found');
  });

  it('fails when no runtime is compatible', async () => {
    const library = new InMemoryGameLibrary();
    await library.save(game);
    const orchestrator = new UnifiedGameLaunchOrchestrator(library, { resolve: async () => undefined });
    await expect(orchestrator.launch(game.id)).rejects.toThrow('No compatible runtime');
  });
});
