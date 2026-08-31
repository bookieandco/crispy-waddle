'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createCastingManager, createDirectSourceAdapter, createPlaybackResolver, createUnifiedMediaSession, createYouTubePlaybackAdapter } from '@jhadina/tv-core'
import type { MediaItem, MediaSessionSnapshot, PlaybackHost, PlaybackTarget } from '@jhadina/tv-core'

function baseSnapshot(item: MediaItem, positionMs = 0, playing = false, volume = 1): MediaSessionSnapshot {
  return { sessionId: `media:${item.provider}:${item.id}`, item, queue: { items: [item], currentIndex: 0, shuffle: false, repeat: 'off' }, playback: { status: playing ? 'playing' : 'paused', positionMs, durationMs: item.durationMs, volume, rate: 1, muted: false, updatedAt: Date.now() }, target: { id: 'local', name: 'This device', transport: 'local' }, capabilities: { play: true, pause: true, seek: true, volume: true, captions: false, audioTracks: false, playbackRate: true, fullscreen: true, pictureInPicture: true, cast: true } }
}

function createVideoHost(video: HTMLVideoElement, item: MediaItem): PlaybackHost {
  const listeners = new Set<(state: MediaSessionSnapshot) => void>()
  const getState = (): MediaSessionSnapshot => { const snapshot = baseSnapshot(item, Number.isFinite(video.currentTime) ? video.currentTime * 1000 : 0, !video.paused, video.volume); snapshot.playback.durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : item.durationMs; return snapshot }
  const emit = () => listeners.forEach((listener) => listener(getState()))
  const handlers = { play: emit, pause: emit, timeupdate: emit, volumechange: emit, loadedmetadata: emit, ended: emit }
  Object.entries(handlers).forEach(([event, handler]) => video.addEventListener(event, handler))
  return { play: () => video.play(), pause: () => video.pause(), seek: (position) => { video.currentTime = Math.max(0, position) }, setVolume: (value) => { video.volume = Math.max(0, Math.min(1, value)) }, getState, onStateChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener) }, destroy: () => Object.entries(handlers).forEach(([event, handler]) => video.removeEventListener(event, handler)) }
}

function extractYouTubeId(item: MediaItem) { const match = item.canonicalUrl?.match(/[?&]v=([^&]+)/) ?? item.canonicalUrl?.match(/youtu\.be\/([^?&]+)/); return match?.[1] ?? item.id }

function createYouTubeHost(iframe: HTMLIFrameElement, item: MediaItem): PlaybackHost {
  const listeners = new Set<(state: MediaSessionSnapshot) => void>(); let playing = false; let positionMs = 0; let volume = 1
  const getState = () => baseSnapshot(item, positionMs, playing, volume)
  const emit = () => listeners.forEach((listener) => listener(getState()))
  const command = (func: string, args: unknown[] = []) => iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com')
  return { play: async () => { command('playVideo'); playing = true; emit() }, pause: () => { command('pauseVideo'); playing = false; emit() }, seek: (position) => { positionMs = Math.max(0, position) * 1000; command('seekTo', [positionMs / 1000, true]); emit() }, setVolume: (value) => { volume = Math.max(0, Math.min(1, value)); command('setVolume', [Math.round(volume * 100)]); emit() }, getState, onStateChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener) }, destroy: () => listeners.clear() }
}

function YouTubeFrame({ item, onHost }: { item: MediaItem; onHost: (host: PlaybackHost) => void }) { const ref = useRef<HTMLIFrameElement>(null); const videoId = useMemo(() => extractYouTubeId(item), [item]); useEffect(() => { if (ref.current) onHost(createYouTubeHost(ref.current, item)) }, [item, onHost]); return <iframe ref={ref} title={item.title} src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12, background: '#000' }} /> }

export default function MediaSessionPlayer({ item }: { item: MediaItem }) {
  const videoRef = useRef<HTMLVideoElement>(null); const [youtubeHost, setYoutubeHost] = useState<PlaybackHost | null>(null); const [state, setState] = useState<MediaSessionSnapshot | null>(null); const [targets, setTargets] = useState<PlaybackTarget[]>([]); const [error, setError] = useState<string | null>(null)
  const resolver = useMemo(() => createPlaybackResolver([createYouTubePlaybackAdapter(), createDirectSourceAdapter()]), []); const adapter = resolver.resolve(item)
  useEffect(() => { const host = adapter?.kind === 'youtube' ? youtubeHost : videoRef.current ? createVideoHost(videoRef.current, item) : null; if (!adapter || !host) return; let active = true; const casting = createCastingManager([], host.getState()); adapter.create({ item, casting, host }).then((local) => { if (!active) return local.destroy?.(); const session = createUnifiedMediaSession({ sessionId: `media:${item.provider}:${item.id}`, itemId: item.id, itemKind: item.kind, sourceUrl: item.playbackUrl ?? item.canonicalUrl ?? '', local, casting }); const unsubscribe = session.subscribe(setState); setState(session.getState()); return () => { unsubscribe(); local.destroy?.() } }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not initialize playback')); return () => { active = false } }, [adapter, item, youtubeHost])
  const play = async () => { setError(null); try { if (!state) throw new Error('Playback session is still loading.'); const host = adapter?.kind === 'youtube' ? youtubeHost : videoRef.current ? createVideoHost(videoRef.current, item) : null; if (!host) throw new Error('Playback surface is unavailable.'); await host.play() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Playback failed') } }
  const discover = async () => { setError(null); try { if (!state) throw new Error('Playback session is still loading.'); setTargets(await createCastingManager([], state).discover()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not discover playback targets') } }
  return <section style={{ marginTop: 36, padding: 20, borderRadius: 18, background: '#0f1117', border: '1px solid #242832' }}>{adapter?.kind === 'youtube' ? <YouTubeFrame item={item} onHost={setYoutubeHost} /> : <video ref={videoRef} controls playsInline preload="metadata" data-title-id={item.id} data-kind={item.kind} src={item.playbackUrl ?? item.canonicalUrl} style={{ width: '100%', maxHeight: 620, borderRadius: 12, background: '#000' }} />}<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}><button type="button" onClick={play}>{adapter?.kind === 'youtube' ? 'Play on YouTube' : 'Play / Resume'}</button><button type="button" onClick={discover}>Cast / Device</button></div>{state && <p style={{ color: '#9da2ae', fontSize: 13 }}>Session: {state.playback.status} · {Math.floor(state.playback.positionMs / 1000)}s · {state.target?.name ?? 'This device'}</p>}{targets.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{targets.map((target) => <span key={target.id}>{target.name}</span>)}</div>}{error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}</section>
}
