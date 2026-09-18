import { useEffect, useMemo, useState } from 'react';
import type { MediaTitle } from '@jhadina/tv-core';
import { JHADINA_TV_ROUTES, recommendTitles } from '@jhadina/tv-core';

export default function JhadinaTVHome() {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<MediaTitle[]>([]);

  useEffect(() => {
    let active = true;
    fetch(`/api/jhadinatv/search?q=${encodeURIComponent(query)}`).then((response) => response.json()).then(({ titles }) => { if (active) setCatalog(titles); });
    return () => { active = false; };
  }, [query]);

  const recommendations = useMemo(() => recommendTitles(catalog, { query }), [catalog, query]);
  const visible = recommendations.length ? recommendations.map(({ title }) => title) : catalog;

  return (
    <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 40 }}>
        <strong style={{ fontSize: 24 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ marginLeft: 'auto', width: 360, maxWidth: '60vw', padding: 12, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>
      <h1>Your entertainment, with an intelligence layer.</h1>
      <p style={{ color: '#a8abb5', maxWidth: 700 }}>Catalog discovery is routed through JhadinaTV&apos;s authorized provider boundary. Playback and casting stay behind the core media-session contracts.</p>
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
