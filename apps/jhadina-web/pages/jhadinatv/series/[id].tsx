import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import type { TVSeries, TVSeason, TVEpisode } from '@jhadina/tv-core';
type Hierarchy = { series: TVSeries; seasons: TVSeason[]; episodes: TVEpisode[] };
export default function Series() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';
  const [data, setData] = useState<Hierarchy | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!router.isReady || !id) return;
    let active = true;
    fetch(`/api/jhadinatv/series?id=${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? 'Series unavailable');
        return body as Hierarchy;
      })
      .then(result => { if (active) { setData(result); setError(''); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Cannot load episodes'); });
    return () => { active = false; };
  }, [id, router.isReady]);
  return <main style={{ minHeight: '100vh', background: '#0b0d12', color: '#fff', padding: 20 }}>
    <a style={{ color: '#9fe6ce' }} href="/jhadinatv/tv">← Series</a>
    {error && <p role="alert">{error}</p>}
    {!error && !data && <p>Loading your authorized series…</p>}
    {data && <><h1>{data.series.title}</h1><p>{data.series.overview}</p>
      {data.seasons.map(season => <section key={season.id}>
        <h2>{season.title || `Season ${season.seasonNumber}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
          {data.episodes.filter(episode => episode.seasonId === season.id).map(episode => <article key={episode.id}
            style={{ padding: 16, borderRadius: 14, border: '1px solid #39404c', background: '#171d24' }}>
            <h3>{episode.episodeNumber}. {episode.title}</h3>
            <p>{episode.overview.slice(0, 240)}</p>
            <a style={{ color: '#9fe6ce' }} href={`/jhadinatv/watch/tv/${encodeURIComponent(episode.id)}`}>▶ Play episode</a>
          </article>)}
        </div>
      </section>)}
      {!data.episodes.length && <p>No playable episodes were returned by the authorized provider.</p>}
    </>}
  </main>;
}
