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
    <main style={{ minHeight: '100vh', padding: '28px clamp(18px, 4vw, 56px)', background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 38 }}>
        <strong style={{ fontSize: 25 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <nav style={{ display: 'flex', gap: 10 }} aria-label="JhadinaTV navigation">
          <a href="/jhadinatv" style={{ color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 999, background: '#1a1c22' }}>Home</a>
          <a href="/jhadinatv/tv" style={{ color: '#fff', textDecoration: 'none', padding: '8px 12px', borderRadius: 999, background: '#1a1c22' }}>Live TV</a>
        </nav>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ marginLeft: 'auto', width: 360, maxWidth: '100%', padding: 12, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>

      <section style={{ padding: 'clamp(24px, 5vw, 52px)', borderRadius: 28, background: 'linear-gradient(135deg, #151821, #0d0f14)', border: '1px solid #272a34' }}>
        <div style={{ color: '#9296a2', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 12 }}>Your television</div>
        <h1 style={{ fontSize: 'clamp(38px, 7vw, 76px)', lineHeight: .98, maxWidth: 800, margin: '12px 0 18px' }}>Everything you watch. One intelligent TV.</h1>
        <p style={{ color: '#b0b3bd', maxWidth: 720, lineHeight: 1.6 }}>Personal libraries, Live TV, authorized public channels, programming guides, and Jhadina-curated channels are designed to live behind one media experience.</p>
        <a href="/jhadinatv/tv" style={{ display: 'inline-block', marginTop: 18, padding: '12px 18px', borderRadius: 999, background: '#fff', color: '#090a0d', textDecoration: 'none', fontWeight: 750 }}>Open Live Guide</a>
      </section>

      <section style={{ marginTop: 42 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 16 }}>
          <div><div style={{ color: '#9296a2', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 12 }}>On demand</div><h2 style={{ margin: '8px 0' }}>Recommended for you</h2></div>
          <a href="/jhadinatv/tv" style={{ color: '#cfd2da' }}>What's on now →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginTop: 18 }}>
          {visible.map((title) => (
            <article key={title.id} style={{ padding: 18, borderRadius: 18, background: '#111319', border: '1px solid #23262f' }}>
              <small style={{ color: '#9296a2' }}>{title.kind.toUpperCase()} · {title.year} · {title.availability}</small>
              <h3>{title.title}</h3>
              <p style={{ color: '#9b9eaa', lineHeight: 1.5 }}>{title.overview}</p>
              <a href={JHADINA_TV_ROUTES.watch(title.kind, title.id)} style={{ color: '#fff' }}>Watch</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
