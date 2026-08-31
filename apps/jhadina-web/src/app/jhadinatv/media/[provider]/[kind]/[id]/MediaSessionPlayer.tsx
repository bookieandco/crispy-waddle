'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createUnifiedMediaSession, createCastingManager } from '@jhadina/tv-core'
import type { MediaItem, MediaSessionState, PlaybackTarget } from '@jhadina/tv-core'

type LocalAdapter = ReturnType<typeof createDirectAdapter>

function createDirectAdapter(video: HTMLVideoElement) {
  const listeners = new Set<(state: MediaSessionState) => void>()
  const state = (): MediaSessionState => ({ titleId: video.dataset.titleId ?? '', kind: (video.dataset.kind as MediaSessionState['kind']) ?? 'movie', sourceUrl: video.currentSrc, positionSeconds: video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined, playing: !video.paused, volume: video.volume, target: { id: 'local', name: 'This device', transport: 'local' } })
  const emit = () => listeners.forEach((listener) => listener(state()))
  const handlers = { play: emit, pause: emit, timeupdate: emit, volumechange: emit }
  Object.entries(handlers).forEach(([event, handler]) => video.addEventListener(event, handler))
  return { getState: state, async apply(command: { type: 'play' | 'pause' | 'seek' | 'set-volume'; value?: number }) { if (command.type === 'play') await video.play(); if (command.type === 'pause') video.pause(); if (command.type === 'seek') video.currentTime = Math.max(0, command.value ?? 0); if (command.type === 'set-volume') video.volume = Math.max(0, Math.min(1, command.value ?? 1)); emit() }, onStateChange(listener: (next: MediaSessionState) => void) { listeners.add(listener); return () => listeners.delete(listener) }, destroy() { Object.entries(handlers).forEach(([event, handler]) => video.removeEventListener(event, handler)) } }
}

function YouTubePlayer({ item, onReady }: { item: MediaItem; onReady: (play: () => Promise<void>) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const videoId = useMemo(() => { const match = item.canonicalUrl.match(/[?&]v=([^&]+)/) ?? item.canonicalUrl.match(/youtu\.be\/([^?&]+)/); return match?.[1] ?? item.id }, [item.canonicalUrl, item.id])
  useEffect(() => { onReady(async () => { if (!ready) throw new Error('YouTube player is still loading'); iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), 'https://www.youtube.com') }) }, [onReady, ready])
  return <iframe ref={iframeRef} title={item.title} src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1`} onLoad={() => setReady(true)} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12, background: '#000' }} />
}

export default function MediaSessionPlayer({ item }: { item: MediaItem }) {
  const videoRef = useRef<HTMLVideoElement>(null); const sessionRef = useRef<ReturnType<typeof createUnifiedMediaSession> | null>(null); const [state, setState] = useState<MediaSessionState | null>(null); const [targets, setTargets] = useState<PlaybackTarget[]>([]); const [error, setError] = useState<string | null>(null); const [youtubePlay, setYoutubePlay] = useState<(() => Promise<void>) | null>(null)
  const isYouTube = item.provider === 'youtube'
  const setYouTubePlay = (play: () => Promise<void>) => setYoutubePlay(() => play)
  useEffect(() => { if (isYouTube) return; const video = videoRef.current; if (!video) return; const local = createDirectAdapter(video); const casting = createCastingManager([], local.getState()); const session = createUnifiedMediaSession({ titleId: item.id, kind: item.kind === 'video' ? 'tv' : 'movie', sourceUrl: item.canonicalUrl, local, casting }); sessionRef.current = session; setState(session.getState()); const unsubscribe = session.subscribe(setState); return () => { unsubscribe(); local.destroy(); sessionRef.current = null } }, [isYouTube, item.id, item.kind, item.canonicalUrl])
  const play = async () => { setError(null); try { if (isYouTube) await youtubePlay?.(); else await sessionRef.current?.play() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Playback failed') } }
  const discover = async () => { setError(null); try { setTargets(await sessionRef.current?.discoverTargets() ?? []) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not discover playback targets') } }
  return <section style={{ marginTop: 36, padding: 20, borderRadius: 18, background: '#0f1117', border: '1px solid #242832' }}>{isYouTube ? <YouTubePlayer item={item} onReady={setYouTubePlay} /> : <video ref={videoRef} controls playsInline preload="metadata" data-title-id={item.id} data-kind={item.kind === 'video' ? 'tv' : 'movie'} src={item.canonicalUrl} style={{ width: '100%', maxHeight: 620, borderRadius: 12, background: '#000' }} /> }<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}><button type="button" onClick={play} style={{ padding: '10px 16px', borderRadius: 999 }}>{isYouTube ? 'Play on YouTube' : 'Play / Resume'}</button>{!isYouTube && <button type="button" onClick={discover} style={{ padding: '10px 16px', borderRadius: 999 }}>Choose TV / Device</button>}</div>{!isYouTube && state && <p style={{ color: '#9da2ae', fontSize: 13 }}>Session: {state.playing ? 'playing' : 'paused'} · {Math.floor(state.positionSeconds)}s · {state.target?.name ?? 'This device'}</p>}{targets.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{targets.map((target) => <button key={target.id} type="button" onClick={() => sessionRef.current?.transfer(target)} style={{ padding: '8px 12px', borderRadius: 999 }}>{target.name}</button>)}</div>}{error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}</section>
}
