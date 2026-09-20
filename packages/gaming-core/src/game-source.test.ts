import { describe, expect, it } from 'vitest';
import { normalizeGameSource } from './game-source.js';

describe('normalizeGameSource', () => {
  it('creates a stable canonical id', () => {
    const game = normalizeGameSource({ sourceId: '123', source: 'steam', title: 'Portal', platform: 'pc', contentUri: 'steam://run/400' });
    expect(game).toMatchObject({ id: 'steam:123', title: 'Portal', platform: 'pc', contentUri: 'steam://run/400', installed: false, tags: ['steam'] });
  });

  it('marks local games installed', () => {
    const game = normalizeGameSource({ sourceId: 'gb-1', source: 'local', title: 'Test', platform: 'gameboy', contentUri: 'rom://test.gb' });
    expect(game.installed).toBe(true);
  });

  it('rejects incomplete source records', () => {
    expect(() => normalizeGameSource({ sourceId: '', source: 'steam', title: 'Test', platform: 'pc', contentUri: 'steam://run/1' })).toThrow();
  });
});
