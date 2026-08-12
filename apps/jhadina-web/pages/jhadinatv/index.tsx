import { useEffect, useMemo, useState } from 'react';
import type { MediaTitle } from '@jhadina/tv-core';
import { CatalogRegistry, JHADINA_TV_ROUTES, createAuthorizedCatalogAdapter, recommendTitles } from '@jhadina/tv-core';

const records: MediaTitle[] = [
  { id: 'demo-noir', kind: 'movie', title: 'Midnight Signal', overview: 'A detective follows a strange radio transmission through a city that never sleeps.', year: 2026, runtimeMinutes: 108, genres: ['Crime', 'Mystery', 'Drama'], rating: 8.2, availability: 'public-domain' },
  { id: 'demo-comedy', kind: 'movie', title: 'Second Take', overview: 'Two friends turn a failed audition into an unexpectedly funny road trip.', year: 2025, runtimeMinutes: 96, genres: ['Comedy', 'Road', 'Drama'], rating: 7.8, availability: 'public-domain' },
  { id: 'demo-series', kind: 'tv', title: 'After the Last Train', overview: 'A late-night station becomes the meeting point for four strangers with unfinished stories.', year: 2026, genres: ['Drama', 'Mystery'], rating: 8.6, availability: 'external-link' },
  { id: 'demo-action', kind: 'movie', title: 'Breakline', overview: 'A courier has one night to cross the city and expose the people chasing him.', year: 2025, runtimeMinutes: 112, genres: ['Action', 'Thriller', 'Crime'], rating: 8.0, availability: 'licensed' },
];

const catalogClient = {
  async search(query: string) {
    const needle = query.trim().toLowerCase();
    return records.filter((title) => !needle || `${title.title} ${title.overview} ${title.genres.join(' ')}`.toLowerCase().includes(needle));
  },
  async sources() { return []; },
};

function createRegistry() {
  const registry = new CatalogRegistry();
  registry.register(createAuthorizedCatalogAdapter(catalogClient, { id: 'jhadina-demo', name: 'Jhadina Demo Catalog' }));
  return registry;
}

export default function JhadinaTVHome() {
  const registry = useMemo(createRegistry, []);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<MediaTitle[]>(records);

  useEffect(() => {
    let active = true;
    registry.search({ query }).then((results) => { if (active) setCatalog(results.map(({ title }) => title)); });
    return () => { active = false; };
  }, [query, registry]);

  const recommendations = useMemo(() => recommendTitles(catalog, { query }), [catalog, query]);
  const visible = recommendations.length ? recommendations.map(({ title }) => title) : catalog;

  return (
    <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 40 }}>
        <strong style={{ fontSize: 24 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ marginLeft: 'auto', width: 360, maxWidth: '60vw', padding: 12, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>
      <h1>Your entertainment, with an intelligence layer.</h1>
      <p style={{ color: '#a8abb5', maxWidth: 700 }}>Catalog discovery is routed through JhadinaTV's authorized provider boundary. Playback and casting stay behind the core media-session contracts.</p>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginTop: 36 }}>
        {visible.map((title) => (
          <article key={title.id} style={{ padding: 18, borderRadius: 16, background: '#111319', border: '1px solid #23262f' }}>
            <small style={{ color: '#9296a2' }}>{title.kind.toUpperCase()} · {title.year}</small>
            <h2>{title.title}</h2>
            <p style={{ color: '#9b9eaa', lineHeight: 1.5 }}>{title.overview}</p>
            <a href={JHADINA_TV_ROUTES.watch(title.kind, title.id)} style={{ color: '#fff' }}>Watch</a>
          </article>
        ))}
      </section>
    </main>
  );
}
