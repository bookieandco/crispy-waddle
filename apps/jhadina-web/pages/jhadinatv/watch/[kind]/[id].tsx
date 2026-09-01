import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/router';
import type { MediaKind, MediaSource, MediaTitle, PlaybackTarget, MediaSessionState, LocalPlaybackAdapter, UnifiedMediaSession, ResolvedPlaybackSource } from '@jhadina/tv-core';
import { CatalogRegistry, createAuthorizedCatalogAdapter, createBrowserAirPlayController, createCastingManager, createGoogleCastController, createJhadinaTVReceiverController, createPictureInPictureController, createPlaybackResolver, createResolvedMediaPlayer, createUnifiedMediaSession } from '@jhadina/tv-core';
import { createBrowserGoogleCastRuntime } from '../../../../lib/jhadinatv/google-cast-runtime';
import { createJhadinaTVReceiverTransport } from '../../../../lib/jhadinatv/jhadina-tv-receiver';

const titles: MediaTitle[] = [
  { id: 'demo-noir', kind: 'movie', title: 'Midnight Signal', overview: 'A detective follows a strange radio transmission through a city that never sleeps.', year: 2026, runtimeMinutes: 108, genres: ['Crime', 'Mystery', 'Drama'], rating: 8.2, availability: 'public-domain' },
  { id: 'demo-comedy', kind: 'movie', title: 'Second Take', overview: 'Two friends turn a failed audition into an unexpectedly funny road trip.', year: 2025, runtimeMinutes: 96, genres: ['Comedy', 'Road', 'Drama'], rating: 7.8, availability: 'public-domain' },
  { id: 'demo-series', kind: 'tv', title: 'After the Last Train', overview: 'A late-night station becomes the meeting point for four strangers with unfinished stories.', year: 2026, genres: ['Drama', 'Mystery'], rating: 8.6, availability: 'external-link' },
  { id: 'demo-action', kind: 'movie', title: 'Breakline', overview: 'A courier has one night to cross the city and expose the people chasing him.', year: 2025, runtimeMinutes: 112, genres: ['Action', 'Thriller', 'Crime'], rating: 8.0, availability: 'licensed' },
];

const client = { async search(query: string) { return titles.filter((title) => title.id === query); }, async sources(_titleId: string): Promise<MediaSource[]> { return []; } };
function makeRegistry() { const registry = new CatalogRegistry(); registry.register(createAuthorizedCatalogAdapter(client, { id: 'jhadina-demo', name: 'Jhadina Demo Catalog' })); return registry; }
type AirPlayVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };

export default function JhadinaTVWatchPage() {
  const router = useRouter(); const videoRef = useRef<HTMLVideoElement | null>(null); const registry = useMemo(makeRegistry, []); const sessionRef = useRef<UnifiedMediaSession | null>(null);
  const { kind, id } = router.query as { kind?: MediaKind; id?: string }; const [title, setTitle] = useState<MediaTitle | null>(null); const [playback, setPlayback] = useState<ResolvedPlaybackSource | null>(null); const [error, setError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false); const [target, setTarget] = useState<PlaybackTarget | null>(null); const [targets, setTargets] = useState<PlaybackTarget[]>([]); const [pipSupported, setPipSupported] = useState(false); const [pipActive, setPipActive] = useState(false); const [sessionState, setSessionState] = useState<MediaSessionState | null>(null);
  const source = playback?.source ?? null;

  useEffect(() => {
    if (!router.isReady || !kind || !id) return;
    let active = true;
    registry.search({ query: id }).then(async (results) => {
      const match = results.find(({ title: candidate }) => candidate.id === id && candidate.kind === kind);
      if (!match) throw new Error('Title is not available from the configured catalog.');
      const provider = registry.list().find((candidate) => candidate.id === match.providerId);
      if (!provider) throw new Error('Playback provider is unavailable.');
      const resolver = createPlaybackResolver([{ id: provider.id, adapter: provider.sourceAdapter, authorized: true }]);
      const resolved = await resolver.resolve({ providerId: match.providerId, titleId: match.title.id });
      if (!active) return;
      setTitle(match.title); setPlayback(resolved);
    }).catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Unable to load this title.'));
    return () => { active = false; };
  }, [id, kind, registry, router.isReady]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback || !title) return;
    const resolvedSource = playback.source;
    const snapshot = (): MediaSessionState => ({ titleId: title.id, kind: title.kind, sourceUrl: resolvedSource.url, positionSeconds: video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined, playing: !video.paused, volume: video.volume, target: { id: 'local', name: 'This device', transport: 'local' } });
    const local: LocalPlaybackAdapter = { getState: snapshot, async apply(command) { if (command.type === 'play') await video.play(); else if (command.type === 'pause') video.pause(); else if (command.type === 'seek') video.currentTime = Math.max(0, command.value); else if (command.type === 'set-volume') video.volume = Math.max(0, Math.min(1, command.value)); }, onStateChange(listener) { const sync = () => listener(snapshot()); const events = ['play', 'pause', 'timeupdate', 'durationchange', 'volumechange', 'seeking', 'seeked'] as const; events.forEach((event) => video.addEventListener(event, sync)); sync(); return () => events.forEach((event) => video.removeEventListener(event, sync)); } };
    const player = createResolvedMediaPlayer(playback, { ...local, setSource(url) { video.src = url; } });
    const initial = player.getState(); const controllers = [createBrowserAirPlayController(video as AirPlayVideo, initial, playback)]; if (typeof window !== 'undefined') { const googleRuntime = createBrowserGoogleCastRuntime(); if (googleRuntime.isSupported()) controllers.push(createGoogleCastController(googleRuntime, initial, playback)); controllers.push(createJhadinaTVReceiverController(createJhadinaTVReceiverTransport(), initial, playback)); }
    const casting = createCastingManager(controllers, initial);
    const session = createUnifiedMediaSession({ titleId: title.id, kind: title.kind, playback: player.playback, local: player, casting }); sessionRef.current = session; const unsubscribe = session.subscribe(setSessionState); setSessionState(session.getState()); return () => { unsubscribe(); sessionRef.current = null; };
  }, [playback, title]);

  useEffect(() => { const video = videoRef.current; if (!video) return; const controller = createPictureInPictureController(video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> }); setPipSupported(controller.isSupported()); const sync = () => setPipActive(controller.isActive()); video.addEventListener('enterpictureinpicture', sync); video.addEventListener('leavepictureinpicture', sync); return () => { video.removeEventListener('enterpictureinpicture', sync); video.removeEventListener('leavepictureinpicture', sync); }; }, [source]);
  async function discoverTVs() { try { const session = sessionRef.current; if (!session) return; setTargets(await session.discoverTargets()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to discover TV devices.'); } }
  async function connectTV(nextTarget: PlaybackTarget) { try { const session = sessionRef.current; if (!session) return; await session.transfer(nextTarget); setTarget(nextTarget); setCasting(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to connect to the selected TV.'); } }
  async function disconnectTV() { const session = sessionRef.current; if (session) await session.disconnect(); setCasting(false); setTarget(null); }
  async function togglePiP() { const video = videoRef.current; if (!video) return; const controller = createPictureInPictureController(video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> }); try { await controller.toggle(); setPipActive(controller.isActive()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Picture-in-Picture is unavailable.'); } }
  if (error) return <main style={{ padding: 32 }}><h1>Unable to play</h1><p>{error}</p></main>; if (!title) return <main style={{ padding: 32 }}><p>Loading JhadinaTV session…</p></main>;
  return <><Script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" strategy="afterInteractive" /><main style={{ minHeight: '100vh', background: '#050608', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}><div style={{ maxWidth: 1200, margin: '0 auto' }}><button onClick={() => router.back()} style={{ background: 'transparent', border: 0, color: '#aaa', cursor: 'pointer', padding: 0, marginBottom: 18 }}>← Back</button>
    {source ? <video ref={videoRef} controls playsInline style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 20, background: '#0b0c10' }} /> : <div style={{ aspectRatio: '16 / 9', borderRadius: 20, border: '1px solid #272a33', background: 'radial-gradient(circle at 50% 35%, #252a36, #0b0c10 65%)', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}><div><div style={{ fontSize: 44 }}>▶</div><h1>{title.title}</h1><p style={{ color: '#9da0aa', lineHeight: 1.6 }}>The catalog entry exists, but the configured authorized provider has not returned a playable media source yet.</p></div></div>}
    <h1>{title.title}</h1><p style={{ color: '#9da0aa', lineHeight: 1.6 }}>{title.overview}</p><section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
      {!casting && <button type="button" disabled={!source || !sessionRef.current} onClick={() => void discoverTVs()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: source ? '#fff' : '#383b43', color: source ? '#08090b' : '#aaa', fontWeight: 700 }}>📺 Find TVs</button>}
      {pipSupported && <button type="button" disabled={!source} onClick={() => void togglePiP()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: pipActive ? '#8b5cf6' : '#242730', color: '#fff', fontWeight: 700 }}>{pipActive ? '↙ Exit PiP' : '▣ Picture in Picture'}</button>}
      {casting && target && <button type="button" onClick={() => void disconnectTV()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: '#242730', color: '#fff', fontWeight: 700 }}>Disconnect {target.name}</button>}
    </section>
    {targets.length > 0 && !casting && <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#101218', border: '1px solid #272a33' }}><strong>Choose a TV</strong><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>{targets.map((device) => <button key={`${device.transport}:${device.id}`} onClick={() => void connectTV(device)} style={{ border: '1px solid #353945', borderRadius: 12, padding: '10px 14px', background: '#181b23', color: '#fff', cursor: 'pointer' }}>📺 {device.name}<small style={{ display: 'block', color: '#8f94a1', marginTop: 3 }}>{device.transport}</small></button>)}</div></section>}
    {casting && target && <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#101218', border: '1px solid #272a33' }}><strong>Playing on {target.name}</strong><p style={{ color: '#9296a2', marginBottom: 0 }}>Unified session position: {Math.floor(sessionState?.positionSeconds ?? 0)}s. Your phone remains the controller.</p></section>}
    <section style={{ marginTop: 24 }}><h2>Playback & casting</h2><p style={{ color: '#9296a2', lineHeight: 1.6 }}>Local playback, Picture-in-Picture, AirPlay, Google Cast, and JhadinaTV receivers share one governed media-session state boundary.</p></section>
  </div></main></>;
}
