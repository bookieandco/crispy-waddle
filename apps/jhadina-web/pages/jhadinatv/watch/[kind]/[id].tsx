import { useState } from 'react';
import { useRouter } from 'next/router';
import type { PlaybackTarget } from '@jhadina/tv-core';

export default function JhadinaTVWatchPage() {
  const router = useRouter();
  const { kind, id } = router.query;
  const [casting, setCasting] = useState(false);
  const [target, setTarget] = useState<PlaybackTarget | null>(null);

  function watchOnTV() {
    setCasting(true);
    setTarget({ id: 'discovering', name: 'TV device', transport: 'airplay' });
  }

  return (
    <main style={{ minHeight: '100vh', background: '#050608', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 0, color: '#aaa', cursor: 'pointer', padding: 0, marginBottom: 18 }}>
          ← Back
        </button>
        <div style={{ aspectRatio: '16 / 9', borderRadius: 20, border: '1px solid #272a33', background: 'radial-gradient(circle at 50% 35%, #252a36, #0b0c10 65%)', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 520, padding: 24 }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>▶</div>
            <h1 style={{ margin: 0, fontSize: 30 }}>JhadinaTV Player</h1>
            <p style={{ color: '#9da0aa', lineHeight: 1.6 }}>
              {kind && id ? `Ready for ${kind}/${id}.` : 'Select a title to begin.'} Source adapters are intentionally not connected until an owned, licensed or public-domain media source is configured.
            </p>
          </div>
        </div>

        <section style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={watchOnTV}
            style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: '#fff', color: '#08090b', fontWeight: 700, cursor: 'pointer' }}
          >
            📺 Watch on TV
          </button>
          {casting && (
            <span style={{ color: '#b8bcc7' }}>
              {target ? `TV session ready via ${target.transport}.` : 'Looking for a TV…'}
            </span>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2>Playback & casting contract</h2>
          <p style={{ color: '#9296a2', lineHeight: 1.6 }}>
            Playback uses the JhadinaTV media-source boundary. The same session can later be transferred to AirPlay, Google Cast, or a JhadinaTV TV session without changing the catalog or source adapter.
          </p>
        </section>
      </div>
    </main>
  );
}
