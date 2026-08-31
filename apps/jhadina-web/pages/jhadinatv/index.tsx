import { useEffect, useState } from 'react';
import type { MediaItem } from '@jhadina/tv-core';
import { JHADINA_TV_ROUTES } from '@jhadina/tv-core';

type SearchResponse = {
  success: boolean;
  data?: {
    query: string;
    providers: Array<{ id: string; name: string; capabilities: unknown }>;
    results: MediaItem[];
  };
  error?: string;
};

const categories = [
  { id: 'movies', label: 'Movies' },
  { id: 'tv', label: 'TV' },
  { id: 'music', label: 'Music' },
  { id: 'sports', label: 'Sports' },
  { id: 'youtube', label: 'YouTube' },
];

export default function JhadinaTVHome() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [providers, setProviders] = useState<SearchResponse['data']['providers']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('youtube');

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setResults([]);
      setProviders([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q: needle });
        if (activeCategory === 'youtube') params.set('provider', 'youtube');
        const response = await fetch(`/api/media/search?${params.toString()}`, { signal: controller.signal });
        const payload = (await response.json()) as SearchResponse;
        if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Media search failed');
        setResults(payload.data.results);
        setProviders(payload.data.providers);
      } catch (cause) {
        if ((cause as Error).name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Media search failed');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeCategory]);

  const visible = activeCategory === 'youtube' ? results.filter((item) => item.provider === 'youtube') : results;

  return (
    <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 28 }}>
        <strong style={{ fontSize: 24 }}>JHADINA<span style={{ opacity: .5 }}>TV</span></strong>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search movies, shows, music, sports, or YouTube..." aria-label="Search Jhadina Media" style={{ marginLeft: 'auto', width: 420, maxWidth: '60vw', padding: 12, borderRadius: 999, border: '1px solid #2a2c33', background: '#111319', color: '#fff' }} />
      </header>

      <nav aria-label="Media categories" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 36 }}>
        {categories.map((category) => (
          <button key={category.id} onClick={() => setActiveCategory(category.id)} aria-pressed={activeCategory === category.id} style={{ padding: '10px 16px', borderRadius: 999, border: '1px solid #2a2c33', background: activeCategory === category.id ? '#f7f7f8' : '#111319', color: activeCategory === category.id ? '#08090c' : '#f7f7f8', cursor: 'pointer' }}>
            {category.label}
          </button>
        ))}
      </nav>

      <section>
        <p style={{ color: '#a8abb5', maxWidth: 760 }}>
          One media surface for discovery, with provider-aware playback. Search results identify their source so Jhadina can route playback through the correct Media Session.
        </p>

        {providers.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '18px 0' }} aria-label="Available providers">
            {providers.map((provider) => <span key={provider.id} style={{ padding: '6px 10px', borderRadius: 999, background: '#151821', color: '#aeb2bd', fontSize: 13 }}>{provider.name}</span>)}
          </div>
        )}

        {loading && <p aria-live="polite" style={{ color: '#a8abb5' }}>Searching…</p>}
        {error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}
        {!query.trim() && <p style={{ color: '#727683' }}>Start a search to discover media from configured providers.</p>}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginTop: 24 }}>
          {visible.map((item) => (
            <article key={`${item.providerId}:${item.id}`} style={{ overflow: 'hidden', borderRadius: 16, background: '#111319', border: '1px solid #23262f' }}>
              {item.artworkUrl && <img src={item.artworkUrl} alt="" loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }} />}
              <div style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#9296a2', fontSize: 12 }}>
                  <span>{item.kind.toUpperCase()}</span>
                  <span>{item.provider}</span>
                </div>
                <h2 style={{ marginBottom: 8 }}>{item.title}</h2>
                {item.subtitle && <p style={{ margin: '0 0 8px', color: '#b7bac4' }}>{item.subtitle}</p>}
                {item.description && <p style={{ color: '#9b9eaa', lineHeight: 1.5 }}>{item.description}</p>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
                  {item.capabilities.map((capability) => <span key={capability} style={{ padding: '4px 8px', borderRadius: 6, background: '#1a1d25', color: '#aeb2bd', fontSize: 11 }}>{capability}</span>)}
                </div>
                <a href={JHADINA_TV_ROUTES.watch('movie', item.id)} style={{ color: '#fff' }}>Play / Resume</a>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
