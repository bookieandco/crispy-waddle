import { useEffect, useMemo, useRef, useState } from 'react';
import { JHADINA_TV_ROUTES, buildPrivateNowGuide, importOwnerApprovedM3u, safePrivateStreamUrl,
  type PrivateChannel, type PrivateProgram, type UnifiedGuideRow } from '@jhadina/tv-core';

const STORAGE_KEY = 'jtv-private-live-v1';
interface SavedChannels { version: 1; channels: PrivateChannel[]; guideXml: string; }
interface WorldChannel { id: string; name: string; country: string; categories: string[]; website?: string; access: 'discovery-only'; }
const panel = { border: '1px solid #303745', borderRadius: 16, background: '#141923', padding: 16 } as const;
const button = { background: '#f5f5f5', color: '#101216', border: 0, borderRadius: 12, padding: '10px 14px', fontWeight: 700 as const, cursor: 'pointer' };
const darkButton = { ...button, color: '#f7f7f7', background: '#272f3e' };
const inputStyle = { background: '#0b111c', color: '#fff', border: '1px solid #465065', borderRadius: 10, padding: 10, maxWidth: '100%' };

function restoredChannels(): SavedChannels {
  const fallback: SavedChannels = { version: 1, channels: [], guideXml: '' };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 1_900_000) return fallback;
    const data = JSON.parse(raw) as Partial<SavedChannels>;
    if (data.version !== 1 || !Array.isArray(data.channels)) return fallback;
    const channels: PrivateChannel[] = [];
    for (const item of data.channels.slice(0, 500)) {
      if (!item || item.access !== 'owner-approved-playlist' || typeof item.url !== 'string' ||
          typeof item.id !== 'string' || typeof item.name !== 'string') continue;
      const url = safePrivateStreamUrl(item.url);
      if (!url || !item.name.trim()) continue;
      channels.push({ id: item.id.slice(0, 60), name: item.name.slice(0, 160), url, access: 'owner-approved-playlist',
        reviewedAt: typeof item.reviewedAt === 'string' ? item.reviewedAt : '',
        tvgId: typeof item.tvgId === 'string' ? item.tvgId.slice(0, 160) : undefined,
        country: typeof item.country === 'string' ? item.country.slice(0, 8) : undefined,
        language: typeof item.language === 'string' ? item.language.slice(0, 12) : undefined,
        group: typeof item.group === 'string' ? item.group.slice(0, 80) : undefined,
        logoUrl: typeof item.logoUrl === 'string' ? safePrivateStreamUrl(item.logoUrl) ?? undefined : undefined });
    }
    return { version: 1, channels, guideXml: typeof data.guideXml === 'string' && data.guideXml.length < 1_500_000 ? data.guideXml : '' };
  } catch { return fallback; }
}
function persist(channels: PrivateChannel[], guideXml: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, channels, guideXml } satisfies SavedChannels));
}

export default function JhadinaTVLivePage() {
  const [ownerReady, setOwnerReady] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [providerGuide, setProviderGuide] = useState<UnifiedGuideRow[]>([]);
  const [providerMessage, setProviderMessage] = useState('');
  const [channels, setChannels] = useState<PrivateChannel[]>([]);
  const [guideXml, setGuideXml] = useState('');
  const [playlistText, setPlaylistText] = useState('');
  const [guideInput, setGuideInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [playbackMessage, setPlaybackMessage] = useState('');
  const [playerStatus, setPlayerStatus] = useState('');
  const [world, setWorld] = useState<WorldChannel[]>([]);
  const [worldMessage, setWorldMessage] = useState('');
  const [worldCountry, setWorldCountry] = useState('');
  const [worldQuery, setWorldQuery] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/jhadinatv/live/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403
          ? 'Private JhadinaTV requires the authorized owner account.'
          : 'Owner authentication is not commissioned. Configure JhadinaTV owner identity before accessing private sources.');
        return response.json();
      })
      .then(async status => {
        if (!active) return;
        setOwnerReady(true);
        const saved = restoredChannels();
        setChannels(saved.channels);
        setGuideXml(saved.guideXml);
        setGuideInput(saved.guideXml);
        if (!status.providers?.[0]?.admitted) setProviderMessage('Jellyfin has not been commissioned; your local approved playlists can still be used.');
        try {
          const response = await fetch('/api/jhadinatv/live/guide', { credentials: 'same-origin' });
          if (response.ok) {
            const data = await response.json();
            if (active) setProviderGuide(data.guide ?? []);
          }
        } catch { /* Personal playlist remains independent of the Jellyfin backend. */ }
      })
      .catch(cause => { if (active) setAccessError(cause instanceof Error ? cause.message : 'Owner verification failed.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ownerReady) return;
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [ownerReady]);
  const programs = useMemo(() => {
    try { return buildPrivateNowGuide(channels, guideXml, new Date(clock)); }
    catch { return new Map<string, PrivateProgram>(); }
  }, [channels, guideXml, clock]);
  const countries = useMemo(() => Array.from(new Set(channels.map(c => c.country).filter((v): v is string => Boolean(v)))).sort(), [channels]);
  const languages = useMemo(() => Array.from(new Set(channels.map(c => c.language).filter((v): v is string => Boolean(v)))).sort(), [channels]);
  const categories = useMemo(() => Array.from(new Set(channels.map(c => c.group).filter((v): v is string => Boolean(v)))).sort(), [channels]);
  const filtered = useMemo(() => channels.filter(c =>
    (!country || c.country === country) && (!language || c.language === language) &&
    (!category || c.group === category) &&
    (!query || `${c.name} ${c.country ?? ''} ${c.group ?? ''} ${programs.get(c.id)?.title ?? ''}`.toLowerCase().includes(query.toLowerCase())),
  ), [channels, country, language, category, query, programs]);
  const selected = channels.find(channel => channel.id === selectedId) ?? null;

  function importChannels() {
    try {
      const result = importOwnerApprovedM3u(playlistText, acknowledged);
      if (!result.channels.length) throw new Error('No eligible HTTPS channels were found in this playlist.');
      const next = [...channels];
      const known = new Set(next.map(c => c.url));
      for (const item of result.channels) if (!known.has(item.url) && next.length < 500) { next.push(item); known.add(item.url); }
      persist(next, guideXml);
      setChannels(next);
      setPlaylistText('');
      setAcknowledged(false);
      setImportMessage(`Saved ${next.length - channels.length} approved channel(s) on this device. ${result.skipped} entries skipped. Availability and rights have not been independently verified.`);
    } catch (cause) { setImportMessage(cause instanceof Error ? cause.message : 'Unable to import playlist.'); }
  }
  function importGuide() {
    try {
      if (guideInput.length > 1_500_000) throw new Error('EPG limit is 1.5 MB on this device.');
      buildPrivateNowGuide(channels, guideInput);
      persist(channels, guideInput);
      setGuideXml(guideInput);
      setImportMessage('Program guide saved locally. XMLTV channels are matched by exact tvg-id.');
    } catch (cause) { setImportMessage(cause instanceof Error ? cause.message : 'Guide import failed.'); }
  }
  function removeChannel(id: string) {
    const next = channels.filter(c => c.id !== id);
    try { persist(next, guideXml); setChannels(next); if (selectedId === id) setSelectedId(''); }
    catch { setImportMessage('Could not save channel removal to this device.'); }
  }
  function selectChannel(channel: PrivateChannel) {
    if (!safePrivateStreamUrl(channel.url)) return;
    setSelectedId(channel.id);
    setPlaybackMessage('Tap Play to start with audio. On iPhone, playback requires a user gesture.');
    setPlayerStatus('Source selected. Availability not yet verified.');
  }
  async function startPlayback() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    setPlaybackMessage('');
    try {
      await video.play();
      setPlayerStatus('Playing (the browser is receiving media).');
    } catch (cause) {
      setPlaybackMessage(cause instanceof Error ? cause.message : 'Playback was blocked. Tap the native Play control or try the official broadcaster.');
    }
  }
  async function refreshJellyfinGuide() {
    try {
      const response = await fetch('/api/jhadinatv/live/guide', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Jellyfin Live TV guide is not available.');
      const result = await response.json();
      setProviderGuide(Array.isArray(result.guide) ? result.guide : []);
      setClock(Date.now());
      setProviderMessage('Live provider guide refreshed.');
    } catch (cause) { setProviderMessage(cause instanceof Error ? cause.message : 'Guide refresh failed.'); }
  }
  async function searchWorld() {
    if (!ownerReady) return;
    setWorldMessage('Searching international channel metadata...');
    try {
      const search = new URLSearchParams({ country: worldCountry, q: worldQuery });
      const response = await fetch(`/api/jhadinatv/world/channels?${search.toString()}`, { credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Directory unavailable.');
      setWorld(data.channels ?? []);
      setWorldMessage(`Showing ${data.shown} directory listings. These are not playable sources until independently reviewed and added with permission.`);
    } catch (cause) { setWorldMessage(cause instanceof Error ? cause.message : 'Directory lookup failed.'); }
  }

  return (
    <main style={{ minHeight: '100vh', padding: '20px max(14px, calc((100vw - 1200px)/2))', background: '#090d14', color: '#f8f9fc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <a href={JHADINA_TV_ROUTES.home} style={{ color: '#c7d2ef' }}>← JhadinaTV</a>
        <strong style={{ fontSize: 24, letterSpacing: 2 }}>JHADINA <span style={{ color: '#85ddc5' }}>LIVE</span></strong>
        <small style={{ color: '#a5b5ca' }}>Private · single owner · no rebroadcasting</small>
      </header>
      {accessError && <div role="alert" style={panel}><h2>Private TV locked</h2><p>{accessError}</p></div>}
      {!ownerReady && !accessError && <p role="status">Checking owner access…</p>}
      {ownerReady && <>
        <section style={{ ...panel, marginBottom: 18 }}>
          <h1 style={{ marginTop: 0 }}>Your channels, from anywhere</h1>
          <p style={{ color: '#b9c5d7' }}>Play personal-authorized HTTPS streams directly on this device. Public channel directories are discovery-only. JhadinaTV does not copy or rebroadcast streams.</p>
          {providerMessage && <p style={{ color: '#f3da95' }}>{providerMessage}</p>}
        </section>
        <section aria-label="Live player" style={{ ...panel, marginBottom: 18 }}>
          {selected ? <>
            <h2 style={{ marginTop: 0 }}>{selected.name} <small style={{ color: '#91a6c5', fontSize: 13 }}> · {selected.country || 'Private playlist'}</small></h2>
            <video key={selected.id} ref={videoRef} src={selected.url} controls playsInline preload="none"

              onCanPlay={() => setPlayerStatus('Ready to play.')}
              onPlaying={() => setPlayerStatus('Playing.')}
              onWaiting={() => setPlayerStatus('Buffering or waiting for source...')}
              onStalled={() => setPlayerStatus('Stream stalled. Try reloading or choose another source.')}
              onError={event => {
                const error = event.currentTarget.error;
                setPlayerStatus('Unable to decode or retrieve the stream.');
                setPlaybackMessage(`Stream failed (media code ${error?.code ?? 'unknown'}). It may be offline, region-restricted, incompatible, or disallow embedding.`);
              }}
              style={{ width: '100%', maxHeight: '70vh', aspectRatio: '16/9', background: '#000', borderRadius: 12 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 12, alignItems: 'center' }}>
              <button style={button} onClick={() => void startPlayback()}>▶ Play with sound</button>
              <button style={darkButton} onClick={() => { videoRef.current?.load(); setPlaybackMessage('Reloaded stream. Tap Play.'); }}>↻ Retry</button>
              <button style={darkButton} onClick={() => { const v = videoRef.current; if (v && v.requestFullscreen) void v.requestFullscreen().catch(() => setPlaybackMessage('Fullscreen unavailable on this device.')); }}>⛶ Full screen</button>
              <span role="status" style={{ color: '#a7b9d2', fontSize: 13 }}>{playerStatus}</span>
            </div>
            {playbackMessage && <p role="alert" style={{ color: '#f4cf9f' }}>{playbackMessage}</p>}
            <small style={{ color: '#9ba7bc' }}>Native HLS (.m3u8) works best on iPhone Safari. Other browsers may need an HLS-capable player; a listed channel is not proof it can play.</small>
          </> : <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', textAlign: 'center' }}><div><span style={{ fontSize: 36 }}>📺</span><h2>Select a channel</h2><p style={{ color: '#99aac6' }}>Import an approved playlist below, then choose what to watch.</p></div></div>}
        </section>
        <section aria-label="Personal channels" style={{ ...panel, marginBottom: 18 }}>
          <h2>My Live Channels ({channels.length})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            <input aria-label="Search saved channels" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search channels or programs" style={{ ...inputStyle, flex: '1 1 200px' }} />
            <select aria-label="Filter country" value={country} onChange={e => setCountry(e.target.value)} style={inputStyle}><option value="">All countries</option>{countries.map(x => <option key={x} value={x}>{x}</option>)}</select>
            <select aria-label="Filter language" value={language} onChange={e => setLanguage(e.target.value)} style={inputStyle}><option value="">All languages</option>{languages.map(x => <option key={x} value={x}>{x}</option>)}</select>
            <select aria-label="Filter genre" value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}><option value="">All categories</option>{categories.map(x => <option key={x} value={x}>{x}</option>)}</select>
          </div>
          {filtered.length === 0 && <p style={{ color: '#a9b7c8' }}>No matching approved personal channels. Import a playlist below.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,290px),1fr))', gap: 10 }}>
            {filtered.map(channel => {
              const program = programs.get(channel.id);
              return <div key={channel.id} style={{ borderRadius: 12, border: selectedId === channel.id ? '1px solid #8de2cd' : '1px solid #323c4e', padding: 12, background: '#0b111c', display: 'flex', gap: 12, alignItems: 'center' }}>
                {channel.logoUrl ? <img src={channel.logoUrl} alt="" width={50} height={40} loading="lazy" referrerPolicy="no-referrer" style={{ objectFit: 'contain' }}/> : <span aria-hidden="true">📡</span>}
                <div style={{ flex: 1, minWidth: 0 }}><strong>{channel.name}</strong><div style={{ fontSize: 12, color: '#a3b5d3' }}>{channel.country || 'World'} · {channel.group || 'TV'}{channel.language ? ' · '+channel.language : ''}</div><div style={{ fontSize: 12, color: '#d1d8e5' }}>{program ? `On now: ${program.title} (until ${new Date(program.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : 'Guide not available'}</div></div>
                <button aria-label={`Watch ${channel.name}`} style={button} onClick={() => selectChannel(channel)}>▶</button>
                <button aria-label={`Remove ${channel.name}`} style={{ ...darkButton, padding: '8px' }} onClick={() => removeChannel(channel.id)}>×</button>
              </div>;
            })}
          </div>
          {providerGuide.length > 0 && <div style={{ marginTop: 20 }}><h3>Jellyfin Live TV <button style={{ ...darkButton, fontSize: 12 }} onClick={() => void refreshJellyfinGuide()}>↻ Refresh guide</button></h3><div style={{ display: 'grid', gap: 8 }}>
            {providerGuide.map(({ channel, program }) => <div key={channel.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, padding: 10, border: '1px solid #323c4e', borderRadius: 9 }}>
              <span>{channel.name} — {program?.title ?? 'No guide data'}</span>
              <a style={{ color: '#86e4cf' }} href={JHADINA_TV_ROUTES.watch('tv', channel.mediaId)}>Watch via Jellyfin</a>
            </div>)}
          </div></div>}
        </section>
        <section aria-label="Import playlist" style={{ ...panel, marginBottom: 18 }}>
          <h2>Add your own approved channels</h2>
          <p style={{ color: '#b1c0d6' }}>Paste an M3U playlist that you are entitled to use personally. Imported URLs remain in this browser&apos;s local storage, not in a public catalog. HTTPS sources only; importing cannot verify rights, geography or stream health.</p>
          <label style={{ display: 'block', marginBottom: 9 }}>Or choose a local M3U file (never uploaded): <input aria-label="Choose M3U file" type="file" accept=".m3u,.m3u8,text/plain" onChange={e => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            if (file.size > 512_000) { setImportMessage('Playlist file is too large (500 KiB limit).'); return; }
            void file.text().then(setPlaylistText).catch(() => setImportMessage('Could not read playlist file.'));
          }} /></label>
          <textarea aria-label="M3U playlist text" value={playlistText} onChange={e => setPlaylistText(e.target.value)} maxLength={512000} placeholder={'#EXTM3U\n#EXTINF:-1 tvg-id="MyChannel" tvg-country="US",Example\nhttps://authorized.example/stream.m3u8'} rows={5} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> I confirm these sources are permitted for my personal viewing and understand JhadinaTV does not certify them.</label>
          <button style={button} onClick={importChannels} disabled={!acknowledged || !playlistText.trim()}>Import approved playlist</button>
          <h3>Optional XMLTV program guide</h3>
          <label style={{ display: 'block', margin: '10px 0' }}>Or choose a local XMLTV file: <input aria-label="Choose XMLTV file" type="file" accept=".xml,.xmltv,text/xml" onChange={e => {
            const file = e.currentTarget.files?.[0];
            if (!file) return;
            if (file.size > 1_500_000) { setImportMessage('EPG file is too large (1.5 MB limit).'); return; }
            void file.text().then(setGuideInput).catch(() => setImportMessage('Could not read guide file.'));
          }} /></label>
          <textarea aria-label="XMLTV guide text" value={guideInput} onChange={e => setGuideInput(e.target.value)} maxLength={1500000} placeholder="Paste XMLTV guide data; entries match your channels' tvg-id" rows={3} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          <button style={darkButton} onClick={importGuide}>Save guide locally</button>
          {importMessage && <p role="status" style={{ color: '#b8e7dc' }}>{importMessage}</p>}
        </section>
        <section aria-label="World channel discovery" style={{ ...panel, marginBottom: 18 }}>
          <h2>Explore TV around the world</h2>
          <p style={{ color: '#b8c6db' }}>Search public broadcaster metadata. These entries are <strong>discovery only</strong>, not stream links. Use a channel&apos;s official site where listed; do not assume that any stream has been authorized for JhadinaTV.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <input aria-label="Country code" style={{ ...inputStyle, width: 100 }} placeholder="US, MX, GB" maxLength={2} value={worldCountry} onChange={e => setWorldCountry(e.target.value.toUpperCase())} />
            <input aria-label="Find worldwide channels" style={{ ...inputStyle, flex: '1 1 200px' }} placeholder="News, music, science..." value={worldQuery} onChange={e => setWorldQuery(e.target.value)} />
            <button style={button} onClick={() => void searchWorld()}>Explore</button>
          </div>
          {worldMessage && <p role="status" style={{ color: '#a6e8d8' }}>{worldMessage}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 8 }}>
            {world.map(item => <div key={item.id} style={{ border: '1px solid #354155', padding: 12, borderRadius: 10 }}>
              <strong>{item.name}</strong><div style={{ fontSize: 12, color: '#acbdd5' }}>{item.country} · {item.categories.join(', ')}</div>
              <small style={{ color: '#e8bc80' }}>Access unverified</small>
              {item.website && <div><a href={item.website} target="_blank" rel="noopener noreferrer" style={{ color: '#8addc7' }}>Official website ↗</a></div>}
            </div>)}
          </div>
          <small style={{ color: '#98a7be' }}>Metadata from the IPTV-org community database. No implicit license, proxy or automatic playback.</small>
        </section>
      </>}
    </main>
  );
}
