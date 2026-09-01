import { describe, expect, it } from 'vitest';
import { InMemoryGameLibrary } from './game-library.js';

describe('InMemoryGameLibrary', () => {
  const game = { id: 'gb-1', title: 'Test Game', platform: 'gameboy' as const, contentUri: 'rom://test.gb', installed: true };

  it('stores and retrieves games', async () => {
    const library = new InMemoryGameLibrary();
    await library.save(game);
    expect(await library.get('gb-1')).toEqual(game);
  });

  it('filters games by platform', async () => {
    const library = new InMemoryGameLibrary();
    await library.save(game);
    await library.save({ ...game, id: 'ps5-1', platform: 'ps5', title: 'Console Game' });
    expect(await library.list('gameboy')).toHaveLength(1);
    expect(await library.list('ps5')).toHaveLength(1);
  });

  it('removes games', async () => {
    const library = new InMemoryGameLibrary();
    await library.save(game);
    await library.remove(game.id);
    expect(await library.get(game.id)).toBeUndefined();
  });
});
