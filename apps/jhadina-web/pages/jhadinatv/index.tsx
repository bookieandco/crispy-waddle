import { useEffect, useMemo, useState } from 'react';
import type { MediaTitle } from '@jhadina/tv-core';
import { JHADINA_TV_ROUTES } from '@jhadina/tv-core';

export default function JhadinaTVHome() {
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<MediaTitle[]>([]);
  const [notice, setNotice] = useState('');
  const [readiness, setReadiness] = useState<{
    ownerVerified: boolean; storageReadable: boolean; providerConfigPresent: boolean;
    signingConfigured: boolean; liveCertified: boolean;
  } | null>(null);
  const [readinessMessage, setReadinessMessage] = useState('Checking private TV access…');

  useEffect(() => {
    let active = true;
    const endpoint = query.trim() ? `/api/jhadinatv/ask?q=${encodeURIComponent(query)}` : '/api/jhadinatv/search?q=';
    fetch(endpoint, { credentials: 'same-origin' })
      .then(async (response) => { if (!response.ok) throw new Error('Sign in as the JhadinaTV owner to browse your library.'); return response.json(); })
      .then(({ titles }: { titles?: MediaTitle[] }) => { if (active) { setCatalog(Array.isArray(titles) ? titles : []); setNotice(''); } })
      .catch((cause) => { if (active) { setCatalog([]); setNotice(cause instanceof Error ? cause.message : 'Library unavailable.'); } });
    return () => { active = false; };
  }, [query]);

  useEffect(() => {
    let active = true;
    fetch('/api/jhadinatv/postmerge', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (response.status === 401 || response.status === 403) throw new Error('Owner sign-in required.');
        if (response.status !== 200 && response.status !== 503) throw new Error('TV readiness could not be checked.');
        const result = await response.json();
        if (!result || result.ownerVerified !== true) throw new Error('Owner sign-in required.');
        return result;
      })
      .then(data => { if (active) { setReadiness(data); setReadinessMessage(''); } })
      .catch(error => { if (active) { setReadiness(null); setReadinessMessage(error instanceof Error ? error.message : 'Private TV access unavailable.'); } });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => catalog, [catalog]);

  return (
    <main style={{ minHeight: '100vh', padding: 'clamp(14px, 4vw, 32px)', overflowX: 'hidden', background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <strong style={{ fontSize: 24 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <a href={JHADINA_TV_ROUTES.live} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, minHeight: 44, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>● Live TV</a>
        <a href={JHADINA_TV_ROUTES.movies} style={{ color: '#fff', minHeight: 44, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>Movies</a>
        <a href={JHADINA_TV_ROUTES.tv} style={{ color: '#fff', minHeight: 44, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}>Series</a>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask Jhadina what to watch..." aria-label="Search JhadinaTV" style={{ flex: '1 1 220px', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', padding: 12, minHeight: 44, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>
      <section aria-label="Private TV readiness" role="status" style={{ border: '1px solid #303948', borderRadius: 14, padding: 14, marginBottom: 22, background: '#151923', lineHeight: 1.5 }}>
        {readiness ? <>
          <strong>Private TV access: verified owner</strong>
          <p style={{ margin: '8px 0 0', color: '#b9c5d7' }}>Viewing history: {readiness.storageReadable ? 'connected' : 'not ready'} · Jellyfin: {readiness.providerConfigPresent && readiness.signingConfigured ? 'configured, device test required' : 'not connected'} · Live certified: {readiness.liveCertified ? 'yes' : 'no'}</p>
          {!readiness.providerConfigPresent && <p style={{ margin: '8px 0 0', color: '#e5c88a' }}>Your own approved HTTPS playlist can be played on this iPhone without Jellyfin. Public directory entries are discovery-only.</p>}
        </> : <>
          <strong>Private TV locked or unavailable</strong>
          <p style={{ margin: '8px 0', color: '#e5c88a' }}>{readinessMessage}</p>
          <a href="/login?next=%2Fjhadinatv" style={{ color: '#9de5c8', display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>Owner sign-in →</a>
        </>}
      </section>
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
            <a href={title.kind === 'tv' && !title.genres.includes('Live TV') ? JHADINA_TV_ROUTES.series(title.id) : JHADINA_TV_ROUTES.watch(title.kind, title.id)} style={{ color: '#fff' }}>Browse / Watch</a>
          </article>
        ))}
      </section>
    </main>
  );
}
