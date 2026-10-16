import { useEffect, useState } from 'react';
import type { MediaTitle } from '@jhadina/tv-core';

type BrowseKind = 'movie' | 'tv' | 'all';
export function MediaBrowse({ kind }: { kind: BrowseKind }) {
  const [query, setQuery] = useState('');
  const [titles, setTitles] = useState<MediaTitle[]>([]);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (typeof window !== 'undefined') setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
  }, []);
  useEffect(() => {
    let active = true;
    const handle = setTimeout(() => {
      fetch(`/api/jhadinatv/search?q=${encodeURIComponent(query)}`, { credentials: 'same-origin', cache: 'no-store' })
        .then(async response => {
          const payload = await response.json() as { titles?: MediaTitle[]; error?: string };
          if (!response.ok) throw new Error(payload.error ?? 'Library unavailable');
          return payload.titles ?? [];
        })
        .then(data => { if (active) { setTitles(data.filter(item => kind === 'all' || item.kind === kind)); setNotice(''); } })
        .catch(error => { if (active) { setTitles([]); setNotice(error instanceof Error ? error.message : 'Library unavailable'); } });
    }, 200);
    return () => { active = false; clearTimeout(handle); };
  }, [kind, query]);
  const detailLink = (title: MediaTitle) =>
    title.kind === 'tv' && !title.genres.includes('Live TV')
      ? `/jhadinatv/series/${encodeURIComponent(title.id)}`
      : `/jhadinatv/watch/${title.kind}/${encodeURIComponent(title.id)}`;
  return <main style={{ minHeight: '100vh', background: '#090d14', color: '#f5f6f9', padding: 22 }}>
    <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
      <a style={{ color: '#9fe6ce' }} href="/jhadinatv">JhadinaTV</a>
      <a style={{ color: '#fff' }} href="/jhadinatv/movies">Movies</a>
      <a style={{ color: '#fff' }} href="/jhadinatv/tv">Series</a>
      <a style={{ color: '#fff' }} href="/jhadinatv/live">Live TV</a>
    </nav>
    <h1>{kind === 'movie' ? 'Movies' : kind === 'tv' ? 'Series and channels' : 'Search JhadinaTV'}</h1>
    <label>Find something to watch
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Title, genre, actor..." style={{
        display: 'block', boxSizing: 'border-box', marginTop: 8, padding: 13,
        width: '100%', maxWidth: 560, background: '#161e27', color: '#fff', border: '1px solid #465066', borderRadius: 12,
      }}/>
    </label>
    {notice && <p role="alert">{notice}</p>}
    {!notice && !titles.length && <p>No admitted titles found. Configure an authorized Jellyfin library first.</p>}
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginTop: 24 }}>
      {titles.map(title => <article key={title.providerId + ':' + title.id}
        style={{ background: '#131d27', borderRadius: 16, padding: 18, border: '1px solid #273846' }}>
        <small>{title.kind.toUpperCase()}{title.year > 0 ? ' · ' + title.year : ''}</small>
        <h2 style={{ fontSize: 19 }}>{title.title}</h2>
        <p>{title.overview.slice(0, 180)}</p>
        <a style={{ color: '#9fe6ce' }} href={detailLink(title)}>{title.kind === 'tv' ? 'Browse / Watch →' : 'Watch →'}</a>
      </article>)}
    </section>
  </main>;
}
