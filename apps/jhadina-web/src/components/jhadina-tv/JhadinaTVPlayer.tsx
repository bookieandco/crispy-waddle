'use client'

import { useEffect, useRef, useState } from 'react'
import { PLAYER_SKIP_SECONDS } from '@/lib/jhadina-tv/html5-player-contract'

interface CaptionTrack {
  id: string
  label: string
  language: string
}

interface Props {
  src?: string
  poster?: string
  title?: string
  tracks?: CaptionTrack[]
}

export function JhadinaTVPlayer({ src, poster, title = 'JhadinaTV', tracks = [] }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [captionTrack, setCaptionTrack] = useState<string | null>(null)
  const [translation, setTranslation] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const sync = () => setCurrentTime(video.currentTime)
    const loaded = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    video.addEventListener('timeupdate', sync)
    video.addEventListener('loadedmetadata', loaded)
    video.addEventListener('play', () => setPlaying(true))
    video.addEventListener('pause', () => setPlaying(false))
    return () => {
      video.removeEventListener('timeupdate', sync)
      video.removeEventListener('loadedmetadata', loaded)
    }
  }, [])

  const seek = (delta: number) => {
    const video = videoRef.current
    if (video) video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + delta))
  }

  const toggle = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) await video.play()
    else video.pause()
  }

  const toggleCaptions = () => {
    const video = videoRef.current
    if (!video) return
    const next = captionTrack ? null : tracks[0]?.id ?? null
    Array.from(video.textTracks).forEach((track) => { track.mode = 'disabled' })
    if (next) {
      const track = Array.from(video.textTracks).find((item) => item.label === next || item.language === next)
      if (track) track.mode = 'showing'
    }
    setCaptionTrack(next)
  }

  const format = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="relative aspect-video">
        <video ref={videoRef} src={src} poster={poster} className="h-full w-full" playsInline preload="metadata" aria-label={title} />
      </div>
      <div className="space-y-3 border-t border-white/10 p-4">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => seek(-PLAYER_SKIP_SECONDS)} className="rounded-lg px-3 py-2 hover:bg-white/10" aria-label="Rewind 10 seconds">↶ 10</button>
          <button onClick={toggle} className="rounded-lg px-4 py-2 hover:bg-white/10" aria-label={playing ? 'Pause' : 'Play'}>{playing ? '⏸' : '▶'}</button>
          <button onClick={() => seek(PLAYER_SKIP_SECONDS)} className="rounded-lg px-3 py-2 hover:bg-white/10" aria-label="Fast-forward 10 seconds">10 ↷</button>
          <span className="ml-auto text-white/50">{format(currentTime)} / {format(duration)}</span>
        </div>
        <input aria-label="Playback position" type="range" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={(event) => { const value = Number(event.target.value); if (videoRef.current) videoRef.current.currentTime = value; setCurrentTime(value) }} className="w-full" />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={toggleCaptions} disabled={!tracks.length} className="rounded-lg border border-white/10 px-3 py-2 text-sm disabled:opacity-40">CC {captionTrack ? 'On' : 'Off'}</button>
          {tracks.length > 0 && <select value={translation} onChange={(event) => setTranslation(event.target.value)} className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm"><option value="">Translation</option>{tracks.map((track) => <option key={track.id} value={track.language}>{track.label}</option>)}</select>}
        </div>
      </div>
    </section>
  )
}
