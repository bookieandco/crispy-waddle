'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createCastingManager, createDirectSourceAdapter, createPlaybackResolver, createUnifiedMediaSession, createYouTubePlaybackAdapter } from '@jhadina/tv-core'
import type { MediaItem, MediaSessionState, PlaybackHost, PlaybackTarget } from '@jhadina/tv-core'

function createVideoHost(video: HTMLVideoElement): PlaybackHost {
  const listeners = new Set<(state: MediaSessionState) => void>()
  const getState = (): MediaSessionState => ({ titleId: video.dataset.titleId ?? '', kind: (video.dataset.kind as MediaSessionState['kind']) ?? 'movie', sourceUrl: video.currentSrc, positionSeconds: video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined, playing: !video.paused, volume: video.volume, target: { id: 'local', name: 'This device', transport: 'local' } })
  const emit = () => listeners.forEach((listener) => listener(getState()))
  const handlers = { play: emit, pause: emit, timeupdate: emit, volumechange: emit }
  Object.entries(handlers).forEach(([event, handler]) => video.addEventListener(event, handler))
  return { play: () => video.play(), pause: () => video.pause(), seek: (position) => { video.currentTime = Math.max(0, position) }, setVolume: (value) => { video.volume = Math.max(0, Math.min(1, value)) }, getState, onStateChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener) }, destroy: () => Object.entries(handlers).forEach(([event, handler]) => video.removeEventListener(event, handler)) }
}

function extractYouTubeId(item: MediaItem) {
  const match = item.canonicalUrl.match(/[?&]v=([^&]+)/) ?? item.canonicalUrl.match(/youtu\.be\/([^?&]+)/)
  return match?.[1] ?? item.id
}

function createYouTubeHost(iframe: HTMLIFrameElement, item: MediaItem): PlaybackHost {
  const listeners = new Set<(state: MediaSessionState) => void>()
  let playing = false
  let positionSeconds = 0
  const sourceUrl = item.canonicalUrl
  const getState = (): MediaSessionState => ({ titleId: item.id, kind: item.kind === 'video' ? 'tv' : 'movie', sourceUrl, positionSeconds, playing, target: { id: 'local', name: 'This device', transport: 'local' } })
  const emit = () => listeners.forEach((listener) => listener(getState()))
  const command = (func: string, args: unknown[] = []) => iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com')
  return { play: async () => { command('playVideo'); playing = true; emit() }, pause: () => { command('pauseVideo'); playing = false; emit() }, seek: (position) => { positionSeconds = Math.max(0, position); command('seekTo', [positionSeconds, true]); emit() }, setVolume: (value) => { command('setVolume', [Math.round(Math.max(0, Math.min(1, value)) * 100)]); emit() }, getState, onStateChange: (listener) => { listeners.add(listener); return () => listeners.delete(listener) }, destroy: () => listeners.clear() }
}

function YouTubeFrame({ item, onHost }: { item: MediaItem; onHost: (host: PlaybackHost) => void }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const videoId = useMemo(() => extractYouTubeId(item), [item])
  useEffect(() => { if (ref.current) onHost(createYouTubeHost(ref.current, item)) }, [item, onHost])
  return <iframe ref={ref} title={item.title} src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ width: '100%', aspectRatio: '16 / 9', border: 0, borderRadius: 12, background: '#000' }} />
}

export default function MediaSessionPlayer({ item }: { item: MediaItem }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [youtubeHost, setYoutubeHost] = useState<PlaybackHost | null>(null)
  const [state, setState] = useState<MediaSessionState | null>(null)
  const [targets, setTargets] = useState<PlaybackTarget[]>([])
  const [error, setError] = useState<string | null>(null)
  const resolver = useMemo(() => createPlaybackResolver([createYouTubePlaybackAdapter(), createDirectSourceAdapter()]), [])
  const adapter = resolver.resolve(item)
  const isYouTubeAdapter = adapter?.kind === 'youtube'

  useEffect(() => {
    const host = isYouTubeAdapter ? youtubeHost : videoRef.current ? createVideoHost(videoRef.current) : null
    if (!adapter || !host) return
    let active = true
    const casting = createCastingManager([], host.getState())
    adapter.create({ item, casting, host }).then((local) => {
      if (!active) return local.destroy?.()
      const session = createUnifiedMediaSession({ titleId: item.id, kind: item.kind === 'video' ? 'tv' : 'movie', sourceUrl: item.canonicalUrl, local, casting })
      const unsubscribe = session.subscribe(setState)
      setState(session.getState())
      ;(window as Window & { __jhadinaMediaSession?: typeof session }).__jhadinaMediaSession = session
      return () => { unsubscribe(); local.destroy?.() }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not initialize playback'))
    return () => { active = false }
  }, [adapter, item, isYouTubeAdapter, youtubeHost])

  const play = async () => { setError(null); try { const session = (window as Window & { __jhadinaMediaSession?: { play(): Promise<void> } }).__jhadinaMediaSession; if (!session) throw new Error('Playback session is still loading.'); await session.play() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Playback failed') } }
  const discover = async () => { setError(null); try { const session = (window as Window & { __jhadinaMediaSession?: { discoverTargets(): Promise<PlaybackTarget[]> } }).__jhadinaMediaSession; if (!session) throw new Error('Playback session is still loading.'); setTargets(await session.discoverTargets()) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not discover playback targets') } }
  const transfer = async (target: PlaybackTarget) => { try { const session = (window as Window & { __jhadinaMediaSession?: { transfer(target: PlaybackTarget): Promise<void> } }).__jhadinaMediaSession; if (!session) throw new Error('Playback session is still loading.'); await session.transfer(target) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not transfer playback') } }

  return <section style={{ marginTop: 36, padding: 20, borderRadius: 18, background: '#0f1117', border: '1px solid #242832' }}>{isYouTubeAdapter ? <YouTubeFrame item={item} onHost={setYoutubeHost} /> : <video ref={videoRef} controls playsInline preload="metadata" data-title-id={item.id} data-kind={item.kind === 'video' ? 'tv' : 'movie'} src={item.playbackUrl ?? item.canonicalUrl} style={{ width: '100%', maxHeight: 620, borderRadius: 12, background: '#000' }} />}<div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}><button type="button" onClick={play} style={{ padding: '10px 16px', borderRadius: 999 }}>{isYouTubeAdapter ? 'Play on YouTube' : 'Play / Resume'}</button><button type="button" onClick={discover} style={{ padding: '10px 16px', borderRadius: 999 }}>Cast / Device</button></div>{state && <p style={{ color: '#9da2ae', fontSize: 13 }}>Session: {state.playing ? 'playing' : 'paused'} · {Math.floor(state.positionSeconds)}s · {state.target?.name ?? 'This device'}</p>}{targets.length > 0 && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{targets.map((target) => <button key={target.id} type="button" onClick={() => transfer(target)} style={{ padding: '8px 12px', borderRadius: 999 }}>{target.name}</button>)}</div>}{error && <p role="alert" style={{ color: '#ffb4b4' }}>{error}</p>}</section>
}
