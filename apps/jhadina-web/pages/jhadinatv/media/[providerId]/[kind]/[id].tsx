import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { MediaItem } from '@jhadina/tv-core';

type DetailResponse = { success: boolean; data?: { item: MediaItem; provider: { id: string; name: string; capabilities: unknown }; sources: Array<{ providerId: string; itemId: string; url: string; type: string }> }; error?: string };

export default function MediaDetailPage() {
  const router = useRouter();
  const { providerId, kind, id } = router.query;
  const [data, setData] = useState<DetailResponse['data']>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady || typeof providerId !== 'string' || typeof id !== 'string') return;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/media/${encodeURIComponent(providerId)}/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as DetailResponse;
        if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Media detail failed');
        setData(payload.data);
        setError(null);
      })
      .catch((cause) => { if ((cause as Error).name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Media detail failed'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router.isReady, providerId, id]);

  if (loading) return <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8' }}>Loading media…</main>;
  if (error || !data) return <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8' }}><p role="alert">{error ?? 'Media not found.'}</p><Link href="/jhadinatv">Back to Media Home</Link></main>;

  const { item, provider, sources } = data;
  const playable = item.capabilities.includes('play') || sources.length > 0;
  return <main style={{ minHeight: '100vh', background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}><div style={{ position: 'relative', minHeight: 420, overflow: 'hidden' }}>{(item.backdropUrl ?? item.artworkUrl) && <img src={item.backdropUrl ?? item.artworkUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .38 }} />}<div style={{ position: 'relative', padding: 40, maxWidth: 1000, paddingTop: 220 }}><Link href="/jhadinatv" style={{ color: '#d5d7dc' }}>← Media Home</Link><p style={{ marginTop: 28, color: '#b4b7c1', textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 12 }}>{kind} · {provider.name}</p><h1 style={{ fontSize: 48, margin: '8px 0' }}>{item.title}</h1>{item.subtitle && <p style={{ fontSize: 18, color: '#c4c7cf' }}>{item.subtitle}</p>}<p style={{ maxWidth: 700, color: '#b1b4bf', lineHeight: 1.6 }}>{item.description}</p><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>{item.capabilities.map((capability) => <span key={capability} style={{ padding: '6px 10px', borderRadius: 8, background: '#171a22', color: '#c4c7cf', fontSize: 12 }}>{capability}</span>)}</div><div style={{ display: 'flex', gap: 12, marginTop: 24 }}><button type="button" disabled={!playable} style={{ padding: '12px 22px', borderRadius: 999, border: 0, cursor: playable ? 'pointer' : 'not-allowed' }}>▶ Play</button><button type="button" disabled={!playable} style={{ padding: '12px 22px', borderRadius: 999, border: '1px solid #383c47', background: '#111319', color: '#fff', cursor: playable ? 'pointer' : 'not-allowed' }}>Resume</button><button type="button" disabled={!playable} style={{ padding: '12px 22px', borderRadius: 999, border: '1px solid #383c47', background: '#111319', color: '#fff', cursor: playable ? 'pointer' : 'not-allowed' }}>+ Queue</button></div></div></div><section style={{ maxWidth: 1000, padding: 40 }}><h2>Source</h2><p style={{ color: '#aeb1bc' }}>{provider.name} · {sources.length ? `${sources.length} playback source${sources.length === 1 ? '' : 's'}` : 'Provider-controlled playback'}</p></section></main>;
}
