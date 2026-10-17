import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/router';
import type { LocalPlaybackAdapter, MediaKind, MediaSessionController, MediaSessionState, MediaSource, MediaTitle, PlaybackTarget, UnifiedMediaSession } from '@jhadina/tv-core';
import { assertAuthorizedSource, assertCastableSource, assertMediaRight, createBrowserAirPlayController, createCastingManager, createGoogleCastController, createJhadinaTVReceiverController, createPictureInPictureController, createUnifiedMediaSession } from '@jhadina/tv-core';
import { createBrowserGoogleCastRuntime } from '../../../../lib/jhadinatv/google-cast-runtime';
import { createJhadinaTVReceiverTransport } from '../../../../lib/jhadinatv/jhadina-tv-receiver';
import { TVUserControls } from '../../../../src/components/jhadinaTv/TVUserControls';
import { playbackFailureHint, renewalDelayMs, restoredVodPosition, STREAM_RECOVERY_RETRY_LIMIT } from '../../../../lib/jhadinatv/playback-recovery';

type AirPlayVideo = HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void };

export default function JhadinaTVWatchPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<UnifiedMediaSession | null>(null);
  const { kind, id } = router.query as { kind?: MediaKind; id?: string };

  const [title, setTitle] = useState<MediaTitle | null>(null);
  const [source, setSource] = useState<MediaSource | null>(null);
  const [territory, setTerritory] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);
  const [target, setTarget] = useState<PlaybackTarget | null>(null);
  const [targets, setTargets] = useState<PlaybackTarget[]>([]);
  const [pipSupported, setPipSupported] = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [sessionState, setSessionState] = useState<MediaSessionState | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const playbackEpoch = useRef(0);
  const autoErrorAttempts = useRef(0);
  const resumeAfterRenewal = useRef<{ id: string; position: number; playing: boolean } | null>(null);

  const canCast = Boolean(source?.castUrl && source.authorization?.rights?.includes('casting'));

  useEffect(() => {
    if (!router.isReady || !kind || !id) return;
    let active = true;
    playbackEpoch.current += 1;
    refreshInFlight.current = false; setRefreshing(false);
    setTitle(null); setSource(null); setError(null); setPlaybackNotice('');
    autoErrorAttempts.current = 0;
    resumeAfterRenewal.current = null;

    fetch(`/api/jhadinatv/title?id=${encodeURIComponent(id)}&kind=${encodeURIComponent(kind)}`, { credentials: 'same-origin' })
      .then(async response => {
        const data = await response.json() as { title?: MediaTitle; error?: string };
        if (!response.ok || !data.title) throw new Error(data.error ?? 'Title is unavailable.');
        return data.title;
      })
      .then(async (match: MediaTitle) => {
        if (match.id !== id || match.kind !== kind || !match.providerId) throw new Error('Title identity mismatch.');

        const response = await fetch(`/api/jhadinatv/sources?provider=${encodeURIComponent(match.providerId)}&id=${encodeURIComponent(match.id)}`, { credentials: 'same-origin', cache: 'no-store' });
        const body = await response.json() as {
          sources?: Array<{ providerId: string; source: MediaSource }>;
          territory?: string;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? 'Source resolution failed.');
        if (!active) return;

        const nextTerritory = body.territory;
        setTitle(match);
        setTerritory(nextTerritory);
        if (body.sources?.[0]) {
          const now = new Date();
          const admitted = assertAuthorizedSource(body.sources[0].source, now, nextTerritory);
          setSource(assertMediaRight(admitted, 'playback', now, nextTerritory));
        }
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Unable to load this title.'));

    return () => { active = false; playbackEpoch.current += 1; };
  }, [id, kind, router.isReady]);


  // The decoded token is only a browser renewal hint. The backend still checks
  // the HMAC, exact asset, owner cookie, territory, provider and media rights.
  const refreshSource = useCallback(async (reason: 'renewal' | 'media-error' | 'manual') => {
    if (!title || !source || refreshInFlight.current) return;
    if (casting) {
      setPlaybackNotice('Disconnect the TV and reconnect to renew its authorization.');
      return;
    }
    if (reason === 'media-error') {
      if (autoErrorAttempts.current >= STREAM_RECOVERY_RETRY_LIMIT) return;
      autoErrorAttempts.current += 1;
    }
    refreshInFlight.current = true;
    const currentEpoch = playbackEpoch.current;
    setRefreshing(true);
    const video = videoRef.current;
    const savedPosition = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const wasPlaying = !!video && !video.paused && !video.ended;
    try {
      if (!title.providerId || title.providerId !== 'jellyfin') {
        throw new Error('This provider has no approved playback renewal adapter.');
      }
      const endpoint = '/api/jhadinatv/sources?provider=' + encodeURIComponent(title.providerId) +
        '&id=' + encodeURIComponent(title.id);
      const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) {
        throw new Error(response.status === 401 || response.status === 403
          ? 'Your session or viewing rights need reauthorization. Sign in and try again.'
          : response.status === 503
            ? 'Authorized playback is not commissioned. Try again when the provider is available.'
            : 'Unable to obtain a fresh authorized playback source.');
      }
      const body = await response.json() as {
        sources?: Array<{ providerId: string; source: MediaSource }>;
        territory?: string;
      };
      if (playbackEpoch.current !== currentEpoch) return; // Route changed; discard stale source.
      const candidate = body.sources?.find(entry =>
        entry.providerId === 'jellyfin' && entry.source.titleId === title.id)?.source;
      if (!candidate) throw new Error('The authorized library no longer provides this media.');
      const admitted = assertMediaRight(
        assertAuthorizedSource(candidate, new Date(), body.territory),
        'playback', new Date(), body.territory);
      resumeAfterRenewal.current = { id: title.id, position: savedPosition, playing: wasPlaying };
      setTerritory(body.territory);
      setSource(admitted);
      // Some providers issue two URLs in the same second. Explicitly reload when
      // the next React src prop is unchanged so the player can retry once.
      if (admitted.url === source.url) video?.load();
      setPlaybackNotice(reason === 'media-error'
        ? 'A new authorized source was requested. Tap Play if your iPhone paused playback.'
        : 'Playback authorization refreshed. Tap Play if your iPhone paused playback.');
    } catch (cause) {
      if (playbackEpoch.current === currentEpoch) {
        resumeAfterRenewal.current = null;
        setPlaybackNotice(cause instanceof Error ? cause.message : 'Playback renewal was unavailable.');
      }
    } finally {
      if (playbackEpoch.current === currentEpoch) {
        refreshInFlight.current = false;
        setRefreshing(false);
      }
    }
  }, [title, source, casting]);

  useEffect(() => {
    if (!source) return;
    const delay = renewalDelayMs(source.url);
    if (delay === null) return;
    const timer = window.setTimeout(() => { void refreshSource('renewal'); }, Math.min(delay, 2_147_483_647));
    // iOS can suspend tab timers for a long time; recheck on foreground.
    const whenVisible = () => {
      if (!document.hidden && renewalDelayMs(source.url) === 0) {
        window.clearTimeout(timer);
        void refreshSource('renewal');
      }
    };
    document.addEventListener('visibilitychange', whenVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', whenVisible);
    };
  }, [source, refreshSource]);

  function restoreAfterSourceLoad() {
    const pending = resumeAfterRenewal.current;
    const video = videoRef.current;
    if (!pending || !video || pending.id !== title?.id) return;
    resumeAfterRenewal.current = null;
    if (!title.id.startsWith('jellyfin-live:')) {
      const position = restoredVodPosition(pending.position, video.duration);
      if (position !== null) {
        try { video.currentTime = position; }
        catch { setPlaybackNotice('Tap Play and seek manually to resume.'); }
      }
    }
    if (pending.playing) {
      void video.play().catch(() => {
        setPlaybackNotice('Tap Play to resume with audio. iPhone requires a direct playback gesture.');
      });
    }
  }

  function handlePlayerError() {
    const mediaCode = videoRef.current?.error?.code;
    setPlaybackNotice(playbackFailureHint(mediaCode));
    if (autoErrorAttempts.current < STREAM_RECOVERY_RETRY_LIMIT) {
      void refreshSource('media-error');
    }
  }

  async function playLocally() {
    const video = videoRef.current;
    if (!video) return;
    try { video.muted = false; await video.play(); setPlaybackNotice(''); }
    catch { setPlaybackNotice('Playback requires a tap on the native controls, or an available supported source.'); }
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source || !title) return;
    assertCastableSource(source.url);

    const snapshot = (): MediaSessionState => ({
      titleId: title.id,
      kind: title.kind,
      sourceUrl: source.url,
      positionSeconds: video.currentTime,
      durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
      playing: !video.paused,
      volume: video.volume,
      target: { id: 'local', name: 'This device', transport: 'local' },
    });

    const local: LocalPlaybackAdapter = {
      getState: snapshot,
      async apply(command) {
        if (command.type === 'play') await video.play();
        else if (command.type === 'pause') video.pause();
        else if (command.type === 'seek' && typeof command.value === 'number') video.currentTime = Math.max(0, command.value);
        else if (command.type === 'set-volume' && typeof command.value === 'number') video.volume = Math.max(0, Math.min(1, command.value));
      },
      onStateChange(listener) {
        const sync = () => listener(snapshot());
        const events = ['play', 'pause', 'timeupdate', 'durationchange', 'volumechange', 'seeking', 'seeked'] as const;
        events.forEach((event) => video.addEventListener(event, sync));
        sync();
        return () => events.forEach((event) => video.removeEventListener(event, sync));
      },
    };

    const initial = local.getState();
    const remoteInitial: MediaSessionState = { ...initial, sourceUrl: source.castUrl ?? source.url };
    const controllers: MediaSessionController[] = [];
    if (canCast) {
      controllers.push(createBrowserAirPlayController(video as AirPlayVideo, remoteInitial));
      if (typeof window !== 'undefined') {
        const googleRuntime = createBrowserGoogleCastRuntime();
        if (googleRuntime.isSupported()) controllers.push(createGoogleCastController(googleRuntime, remoteInitial));
        controllers.push(createJhadinaTVReceiverController(createJhadinaTVReceiverTransport(), remoteInitial));
      }
    }

    const castingManager = createCastingManager(controllers, remoteInitial);
    const session = createUnifiedMediaSession({
      titleId: title.id,
      kind: title.kind,
      sourceUrl: source.url,
      local,
      casting: castingManager,
    });
    sessionRef.current = session;
    const unsubscribe = session.subscribe(setSessionState);
    setSessionState(session.getState());

    return () => {
      unsubscribe();
      if (sessionRef.current === session) sessionRef.current = null;
      void session.dispose().catch(() => undefined);
    };
  }, [canCast, source, title]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const controller = createPictureInPictureController(video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> });
    setPipSupported(controller.isSupported());
    const sync = () => setPipActive(controller.isActive());
    video.addEventListener('enterpictureinpicture', sync);
    video.addEventListener('leavepictureinpicture', sync);
    return () => {
      video.removeEventListener('enterpictureinpicture', sync);
      video.removeEventListener('leavepictureinpicture', sync);
    };
  }, [source]);

  async function discoverTVs() {
    try {
      const session = sessionRef.current;
      if (!session || !source) return;
      assertMediaRight(source, 'casting', new Date(), territory);
      setTargets(await session.discoverTargets());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to discover TV devices.');
    }
  }

  async function connectTV(nextTarget: PlaybackTarget) {
    try {
      const session = sessionRef.current;
      if (!session || !source) return;
      assertMediaRight(source, 'casting', new Date(), territory);
      await session.transfer(nextTarget);
      setTarget(nextTarget);
      setCasting(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to connect to the selected TV.');
    }
  }

  async function disconnectTV() {
    const session = sessionRef.current;
    if (session) await session.disconnect();
    setCasting(false);
    setTarget(null);
  }

  async function togglePiP() {
    const video = videoRef.current;
    if (!video) return;
    const controller = createPictureInPictureController(video as HTMLVideoElement & { requestPictureInPicture?: () => Promise<PictureInPictureWindow> });
    try {
      await controller.toggle();
      setPipActive(controller.isActive());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Picture-in-Picture is unavailable.');
    }
  }

  if (error) return <main style={{ padding: 32 }}><h1>Unable to play</h1><p role="alert">{error}</p><button type="button" onClick={() => router.reload()}>Retry library access</button></main>;
  if (!title) return <main style={{ padding: 32 }}><p>Loading JhadinaTV session…</p></main>;

  return (
    <>
      <Script src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1" strategy="afterInteractive" />
      <main style={{ minHeight: '100vh', background: '#050608', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button onClick={() => router.back()} style={{ background: 'transparent', border: 0, color: '#aaa', cursor: 'pointer', padding: 0, marginBottom: 18 }}>← Back</button>

          {source ? (
            <video ref={videoRef} controls playsInline preload="metadata" src={source.url}
              onLoadedMetadata={restoreAfterSourceLoad} onError={handlePlayerError}
              style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: 20, background: '#0b0c10' }} />
          ) : (
            <div style={{ aspectRatio: '16 / 9', borderRadius: 20, border: '1px solid #272a33', background: 'radial-gradient(circle at 50% 35%, #252a36, #0b0c10 65%)', display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
              <div><div style={{ fontSize: 44 }}>▶</div><h1>{title.title}</h1><p style={{ color: '#9da0aa', lineHeight: 1.6 }}>The catalog entry exists, but the configured authorized provider has not returned a playable media source yet.</p></div>
            </div>
          )}

          {source && (
            <section aria-label="Playback recovery" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <button type="button" onClick={() => void playLocally()}
                style={{ background: '#a6f4d3', color: '#111', border: 0, borderRadius: 12, padding: '11px 16px', cursor: 'pointer', fontWeight: 700 }}>
                ▶ Play on this device
              </button>
              <button type="button" disabled={refreshing || casting} onClick={() => void refreshSource('manual')}
                style={{ background: '#222733', color: '#fff', border: 0, borderRadius: 12, padding: '11px 16px', cursor: 'pointer' }}>
                {refreshing ? 'Checking source…' : '↻ Retry secure playback'}
              </button>
              {playbackNotice && <p role="status" style={{ flexBasis: '100%', color: '#f3da95', lineHeight: 1.5 }}>{playbackNotice}</p>}
              <small style={{ color: '#9da0aa' }}>
                iPhone Safari requires a tap to start audio. Renewal is owner-verified and may briefly reload video.
              </small>
            </section>
          )}
          {source && <TVUserControls mediaId={title.id} videoRef={videoRef} />}
          <h1>{title.title}</h1>
          <p style={{ color: '#9da0aa', lineHeight: 1.6 }}>{title.overview}</p>

          <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 18 }}>
            {!casting && (
              <button type="button" disabled={!source || !sessionRef.current || !canCast} onClick={() => void discoverTVs()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: source && canCast ? '#fff' : '#383b43', color: source && canCast ? '#08090b' : '#aaa', fontWeight: 700 }}>
                📺 {canCast ? 'Find TVs' : 'Casting not authorized'}
              </button>
            )}
            {pipSupported && <button type="button" disabled={!source} onClick={() => void togglePiP()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: pipActive ? '#8b5cf6' : '#242730', color: '#fff', fontWeight: 700 }}>{pipActive ? '↙ Exit PiP' : '▣ Picture in Picture'}</button>}
            {casting && target && <button type="button" onClick={() => void disconnectTV()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: '#242730', color: '#fff', fontWeight: 700 }}>Disconnect {target.name}</button>}
          </section>

          {targets.length > 0 && !casting && <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#101218', border: '1px solid #272a33' }}><strong>Choose a TV</strong><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>{targets.map((device) => <button key={`${device.transport}:${device.id}`} onClick={() => void connectTV(device)} style={{ border: '1px solid #353945', borderRadius: 12, padding: '10px 14px', background: '#181b23', color: '#fff', cursor: 'pointer' }}>📺 {device.name}<small style={{ display: 'block', color: '#8f94a1', marginTop: 3 }}>{device.transport}</small></button>)}</div></section>}

          {casting && target && <section style={{ marginTop: 16, padding: 18, borderRadius: 16, background: '#101218', border: '1px solid #272a33' }}><strong>Playing on {target.name}</strong><p style={{ color: '#9296a2', marginBottom: 0 }}>Unified session position: {Math.floor(sessionState?.positionSeconds ?? 0)}s. Your phone remains the controller.</p></section>}

          <section style={{ marginTop: 24 }}>
            <h2>Playback & casting</h2>
            <p style={{ color: '#9296a2', lineHeight: 1.6 }}>Local playback, Picture-in-Picture, AirPlay, Google Cast, and JhadinaTV receivers share one media-session state boundary. Casting is exposed only when the admitted source explicitly grants the casting right.</p>
          </section>
        </div>
      </main>
    </>
  );
}
