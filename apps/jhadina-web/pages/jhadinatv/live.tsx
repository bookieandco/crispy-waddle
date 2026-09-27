import { useEffect, useState } from 'react';
import { JHADINA_TV_ROUTES, type UnifiedGuideRow } from '@jhadina/tv-core';

interface AdmissionStatus {
  admitted: boolean;
  missing: string[];
}

export default function JhadinaTVLivePage() {
  const [guide, setGuide] = useState<UnifiedGuideRow[]>([]);
  const [status, setStatus] = useState<AdmissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/jhadinatv/live/status').then((response) => response.json()),
      fetch('/api/jhadinatv/live/guide').then(async (response) => ({ ok: response.ok, body: await response.json() })),
    ]).then(([statusBody, guideResponse]) => {
      if (!active) return;
      setStatus(statusBody.providers?.[0] ?? null);
      if (guideResponse.ok) setGuide(guideResponse.body.guide ?? []);
      else setError(guideResponse.body.error ?? 'Live TV is not configured.');
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Unable to load Live TV.'));
    return () => { active = false; };
  }, []);

  return (
    <main style={{ minHeight: '100vh', padding: 28, background: '#07080b', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 30 }}>
          <a href={JHADINA_TV_ROUTES.home} style={{ color: '#aaa' }}>← JhadinaTV</a>
          <strong style={{ fontSize: 24 }}>LIVE TV</strong>
        </header>
        <h1>What&apos;s on now</h1>
        <p style={{ color: '#9da0aa', maxWidth: 720 }}>Guide metadata never contains raw provider stream URLs. Choosing a channel resolves playback through the same rights-gated media source path used by the rest of JhadinaTV.</p>

        {status && !status.admitted && (
          <section style={{ marginTop: 24, padding: 18, border: '1px solid #343846', borderRadius: 16, background: '#111319' }}>
            <strong>Live TV provider admission is closed.</strong>
            <p style={{ color: '#a8abb5' }}>Configure the provider environment and verified rights evidence before live playback can be exposed.</p>
            <small style={{ color: '#7f8491' }}>Missing: {status.missing.join(', ')}</small>
          </section>
        )}
        {error && status?.admitted && <p style={{ color: '#ffb4b4' }}>{error}</p>}

        <section style={{ display: 'grid', gap: 12, marginTop: 28 }}>
          {guide.map(({ channel, program }) => (
            <article key={channel.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr auto', gap: 18, alignItems: 'center', padding: 18, background: '#111319', border: '1px solid #242731', borderRadius: 16 }}>
              <div><small style={{ color: '#8d919d' }}>{channel.channelNumber ? `CH ${channel.channelNumber}` : 'LIVE'}</small><h2 style={{ margin: '5px 0' }}>{channel.name}</h2></div>
              <div><strong>{program?.title ?? 'Program information unavailable'}</strong>{program?.description && <p style={{ color: '#9397a2', marginBottom: 0 }}>{program.description}</p>}</div>
              <a href={JHADINA_TV_ROUTES.watch('tv', channel.mediaId)} style={{ display: 'inline-block', padding: '10px 15px', borderRadius: 999, background: '#fff', color: '#08090b', textDecoration: 'none', fontWeight: 700 }}>Watch live</a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
