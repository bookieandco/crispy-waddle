import { useMemo, useState } from 'react';
import type { MediaTitle } from '@jhadina/jhadina-tv-core';
import { recommendTitles } from '@jhadina/jhadina-tv-core';

const catalog: MediaTitle[] = [
  { id: 'demo-noir', kind: 'movie', title: 'Midnight Signal', overview: 'A detective follows a strange radio transmission through a city that never sleeps.', year: 2026, runtimeMinutes: 108, genres: ['Crime', 'Mystery', 'Drama'], rating: 8.2, availability: 'public-domain' },
  { id: 'demo-comedy', kind: 'movie', title: 'Second Take', overview: 'Two friends turn a failed audition into an unexpectedly funny road trip.', year: 2025, runtimeMinutes: 96, genres: ['Comedy', 'Road', 'Drama'], rating: 7.8, availability: 'public-domain' },
  { id: 'demo-series', kind: 'tv', title: 'After the Last Train', overview: 'A late-night station becomes the meeting point for four strangers with unfinished stories.', year: 2026, genres: ['Drama', 'Mystery'], rating: 8.6, availability: 'external-link' },
  { id: 'demo-action', kind: 'movie', title: 'Breakline', overview: 'A courier has one night to cross the city and expose the people chasing him.', year: 2025, runtimeMinutes: 112, genres: ['Action', 'Thriller', 'Crime'], rating: 8.0, availability: 'licensed' },
];

function scoreLabel(score: number) {
  return `${Math.min(99, Math.max(1, Math.round(score)))}% Jhadina Match`;
}

export default function JhadinaTVHome() {
  const [query, setQuery] = useState('');
  const recommendations = useMemo(() => recommendTitles(catalog, { query, maxRuntimeMinutes: query ? 120 : undefined }), [query]);
  const visible = recommendations.length ? recommendations : catalog.map((title) => ({ title, score: 50, reasons: [] as string[] }));

  return (
    <main style={{ minHeight: '100vh', background: '#08090c', color: '#f7f7f8', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ padding: '28px clamp(20px, 5vw, 72px) 72px', maxWidth: 1400, margin: '0 auto' }}>
        <nav style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 48 }}>
          <strong style={{ fontSize: 24, letterSpacing: '-0.04em' }}>JHADINA<span style={{ opacity: 0.55 }}>TV</span></strong>
          <a href="#movies" style={{ color: '#bbb', textDecoration: 'none' }}>Movies</a>
          <a href="#shows" style={{ color: '#bbb', textDecoration: 'none' }}>TV Shows</a>
          <a href="#watchlist" style={{ color: '#bbb', textDecoration: 'none' }}>Watchlist</a>
          <div style={{ marginLeft: 'auto' }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ width: 'min(360px, 48vw)', padding: '12px 15px', borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff', outline: 'none' }} />
          </div>
        </nav>

        <div style={{ borderRadius: 28, padding: '56px clamp(24px, 6vw, 76px)', background: 'linear-gradient(120deg, #181b24, #0d0e13 60%, #19121a)', border: '1px solid #252832' }}>
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: 999, background: '#252936', color: '#c9cbd3', fontSize: 12, marginBottom: 18 }}>JHADINA CURATED</div>
            <h1 style={{ fontSize: 'clamp(40px, 7vw, 78px)', lineHeight: 0.96, letterSpacing: '-0.06em', margin: 0 }}>Your entertainment, with an intelligence layer.</h1>
            <p style={{ color: '#b6b8c1', fontSize: 18, lineHeight: 1.6, margin: '24px 0 0' }}>Search naturally, keep a watchlist, resume where you stopped, and let Jhadina explain why a title fits your mood.</p>
          </div>
        </div>

        <section id="movies" style={{ marginTop: 52 }}>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', marginBottom: 18 }}>
            <div><p style={{ color: '#8f93a0', margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Personalized</p><h2 style={{ fontSize: 30, margin: '6px 0 0', letterSpacing: '-0.04em' }}>{query ? `Matches for “${query}”` : "Jhadina's Picks"}</h2></div>
            <span style={{ color: '#737784', fontSize: 13 }}>Catalog foundation · source adapters next</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18 }}>
            {visible.map(({ title, score, reasons }) => (
              <article key={title.id} style={{ overflow: 'hidden', borderRadius: 18, background: '#111319', border: '1px solid #23262f' }}>
                <div style={{ aspectRatio: '2 / 3', background: 'linear-gradient(145deg, #292d39, #151720 65%, #31202f)', display: 'grid', placeItems: 'end start', padding: 16 }}><span style={{ background: '#0a0b0e', padding: '6px 9px', borderRadius: 999, fontSize: 11 }}>{title.kind === 'movie' ? 'MOVIE' : 'TV'}</span></div>
                <div style={{ padding: 16 }}><div style={{ color: '#9ca0ad', fontSize: 12, marginBottom: 7 }}>{scoreLabel(score)}</div><h3 style={{ margin: 0, fontSize: 18 }}>{title.title}</h3><p style={{ color: '#9699a5', fontSize: 13, lineHeight: 1.45, minHeight: 56 }}>{title.overview}</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{title.genres.map((genre) => <span key={genre} style={{ fontSize: 11, color: '#bfc2ca', padding: '4px 7px', border: '1px solid #2a2d36', borderRadius: 999 }}>{genre}</span>)}</div>{reasons.length > 0 && <p style={{ color: '#c5c7ce', fontSize: 12, marginBottom: 0 }}>Why: {reasons[0]}</p>}</div>
              </article>
            ))}
          </div>
        </section>

        <section id="shows" style={{ marginTop: 52, padding: 24, borderRadius: 18, border: '1px solid #23262f', background: '#0e1015' }}>
          <h2 style={{ marginTop: 0 }}>Architecture status</h2>
          <p style={{ color: '#9fa2ad', lineHeight: 1.6, maxWidth: 760, marginBottom: 0 }}>JhadinaTV is now a first-class module in the monorepo. This first slice deliberately stops at catalog, discovery and explainable recommendations. Video playback will use explicit licensed, owned or public-domain source adapters rather than an unverified stream scraper.</p>
        </section>
      </section>
    </main>
  );
}
