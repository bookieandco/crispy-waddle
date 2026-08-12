import { useRouter } from 'next/router';

export default function JhadinaTVWatchPage() {
  const router = useRouter();
  const { kind, id } = router.query;

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
        <section style={{ marginTop: 24 }}>
          <h2>Playback contract</h2>
          <p style={{ color: '#9296a2', lineHeight: 1.6 }}>
            The player will consume HTTPS HLS/DASH sources from the JhadinaTV media-source boundary. Subtitles, quality selection, resume position and next-episode behavior belong here rather than in the catalog layer.
          </p>
        </section>
      </div>
    </main>
  );
}
