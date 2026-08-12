import { describe, expect, it } from 'vitest';
import { createAuthorizedCatalogAdapter } from './authorized';
import type { MediaSource } from '../source-adapter';

const source: MediaSource = {
  id: 'source-1',
  titleId: 'movie-1',
  url: 'https://example.com/watch/movie-1',
  mimeType: 'video/mp4',
  availability: 'licensed',
};

describe('createAuthorizedCatalogAdapter', () => {
  it('maps provider records to canonical media titles', async () => {
    const provider = createAuthorizedCatalogAdapter(
      {
        async search() {
          return [{
            id: 'movie-1',
            kind: 'movie',
            title: 'Example Movie',
            overview: 'A test title',
            year: 2026,
            genres: ['Drama'],
            availability: 'licensed',
          }];
        },
        async sources() {
          return [source];
        },
      },
      { id: 'test-provider', name: 'Test Provider' },
    );

    await expect(provider.search('example')).resolves.toEqual([
      expect.objectContaining({ id: 'movie-1', title: 'Example Movie', kind: 'movie' }),
    ]);
  });

  it('keeps source resolution separate from catalog metadata', async () => {
    const provider = createAuthorizedCatalogAdapter(
      {
        async search() { return []; },
        async sources(titleId) {
          expect(titleId).toBe('movie-1');
          return [source];
        },
      },
      { id: 'test-provider', name: 'Test Provider' },
    );

    await expect(provider.sourceAdapter.getSources('movie-1')).resolves.toEqual([source]);
  });
});
