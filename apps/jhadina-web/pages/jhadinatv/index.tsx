import { useEffect, useMemo, useState } from 'react';
import type { MediaTitle } from '@jhadina/tv-core';
import { JHADINA_TV_ROUTES } from '@jhadina/tv-core';

export default function JhadinaTVHome() {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<MediaTitle[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    const endpoint = query.trim() ? `/api/jhadinatv/ask?q=${encodeURIComponent(query)}` : '/api/jhadinatv/search?q=';
    fetch(endpoint, { credentials: 'same-origin' })
      .then(async (response) => { if (!response.ok) throw new Error('Sign in as the JhadinaTV owner to browse your library.'); return response.json(); })
      .then(({ titles }: { titles?: MediaTitle[] }) => { if (active) { setCatalog(Array.isArray(titles) ? titles : []); setNotice(''); } })
      .catch((cause) => { if (active) { setCatalog([]); setNotice(cause instanceof Error ? cause.message : 'Library unavailable.'); } });
    return () => { active = false; };
  }, [query]);

  const visible = useMemo(() => catalog, [catalog]);

  return (
    <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 40 }}>
        <strong style={{ fontSize: 24 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <a href={JHADINA_TV_ROUTES.live} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}>● Live TV</a>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ marginLeft: 'auto', width: 360, maxWidth: '60vw', padding: 12, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>
      <h1>Your entertainment, with an intelligence layer.</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <a href={JHADINA_TV_ROUTES.live} style={{ border: '1px solid #34574b', borderRadius: 12, background: '#14261f', padding: '12px 18px', color: '#9de5c8' }}>📺 Open worldwide Live TV / Import my channels →</a>
      </div>
      {notice && <p role="alert" style={{ color: '#ffcfaa' }}>{notice}</p>}
      {visible.length === 0 && !notice && <section style={{ padding: 24, border: '1px solid #303948', borderRadius: 18, background: '#151923' }}>
        <h2>Your library is empty</h2>
        <p>JhadinaTV no longer lists fictitious demo films as licensed or public-domain. Configure your Jellyfin library or import personal Live TV channels to get started.</p>
        <a href={JHADINA_TV_ROUTES.live} style={{ color: '#9de5c8' }}>Set up Live TV →</a>
      </section>}
      <p style={{ color: '#a8abb5', maxWidth: 700 }}>Catalog discovery is routed through JhadinaTV&apos;s authorized provider boundary. Playback and casting stay behind the core media-session contracts.</p>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginTop: 36 }}>
        {visible.map((title) => (
          <article key={`${title.providerId ?? 'unknown'}:${title.id}`} style={{ padding: 18, borderRadius: 16, background: '#111319', border: '1px solid #23262f' }}>
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
