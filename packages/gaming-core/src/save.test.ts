import { describe, expect, it } from 'vitest';
import { InMemorySaveRepository } from './save.js';

describe('InMemorySaveRepository', () => {
  const save = { id: 'save-1', gameId: 'game-1', kind: 'state' as const, uri: 'save://game-1/1', createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z', slot: 1 };
  it('stores and retrieves saves', async () => { const repo = new InMemorySaveRepository(); await repo.save(save); expect(await repo.get(save.id)).toEqual(save); });
  it('filters by game and save kind', async () => { const repo = new InMemorySaveRepository(); await repo.save(save); await repo.save({ ...save, id: 'save-2', kind: 'persistent' }); expect(await repo.list('game-1', 'state')).toHaveLength(1); expect(await repo.list('game-1', 'persistent')).toHaveLength(1); });
  it('removes saves', async () => { const repo = new InMemorySaveRepository(); await repo.save(save); await repo.remove(save.id); expect(await repo.get(save.id)).toBeUndefined(); });
});
