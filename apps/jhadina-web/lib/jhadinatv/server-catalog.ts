import { CatalogRegistry, createAuthorizedCatalogAdapter, createDeterministicMediaAdvisor, createJhadinaTVRuntime, type MediaSource, type MediaTitle } from '@jhadina/tv-core';

const records: MediaTitle[] = [
  { id: 'demo-noir', kind: 'movie', title: 'Midnight Signal', overview: 'A detective follows a strange radio transmission through a city that never sleeps.', year: 2026, runtimeMinutes: 108, genres: ['Crime', 'Mystery', 'Drama'], rating: 8.2, availability: 'public-domain' },
  { id: 'demo-comedy', kind: 'movie', title: 'Second Take', overview: 'Two friends turn a failed audition into an unexpectedly funny road trip.', year: 2025, runtimeMinutes: 96, genres: ['Comedy', 'Road', 'Drama'], rating: 7.8, availability: 'public-domain' },
  { id: 'demo-series', kind: 'tv', title: 'After the Last Train', overview: 'A late-night station becomes the meeting point for four strangers with unfinished stories.', year: 2026, genres: ['Drama', 'Mystery'], rating: 8.6, availability: 'external-link' },
  { id: 'demo-action', kind: 'movie', title: 'Breakline', overview: 'A courier has one night to cross the city and expose the people chasing him.', year: 2025, runtimeMinutes: 112, genres: ['Action', 'Thriller', 'Crime'], rating: 8.0, availability: 'licensed' },
];

const client = {
  async search(query: string) {
    const needle = query.trim().toLowerCase();
    return records.filter((title) => !needle || title.id === needle || `${title.title} ${title.overview} ${title.genres.join(' ')}`.toLowerCase().includes(needle));
  },
  async sources(_titleId: string): Promise<MediaSource[]> { return []; },
};

const registry = new CatalogRegistry();
registry.register(createAuthorizedCatalogAdapter(client, { id: 'jhadina-demo', name: 'Jhadina Demo Catalog' }));

export const jhadinaTVServerRegistry = registry;
export const jhadinaTVServerRuntime = createJhadinaTVRuntime(registry, createDeterministicMediaAdvisor(), {
  getViewingSignals: async () => [],
  getMediaKnowledge: async () => [],
});
