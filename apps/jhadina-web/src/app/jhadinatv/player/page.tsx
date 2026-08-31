'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type QueueItem = { id: string; provider: string; kind: string; title: string; artworkUrl?: string; canonicalUrl?: string }
const STORAGE_KEY = 'jhadina.media.player'

export default function JhadinaMediaPlayer() {
  const [current, setCurrent] = useState<QueueItem | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [expanded, setExpanded] = useState(true)
  const [resume, setResume] = useState(0)

  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { current?: QueueItem; queue?: QueueItem[]; position?: number } | null; setCurrent(saved?.current ?? null); setQueue(saved?.queue ?? []); setResume(saved?.position ?? 0) } catch {} }, [])
  useEffect(() => { if (!current) return; localStorage.setItem(STORAGE_KEY, JSON.stringify({ current, queue, position: resume })) }, [current, queue, resume])

  const next = useMemo(() => queue[0] ?? null, [queue])
  if (!current) return <main style={{ minHeight: '100vh', padding: 32, background: '#08090c', color: '#f7f7f8' }}><Link href="/jhadinatv">← Media Home</Link><h1>Player</h1><p style={{ color: '#9da2ae' }}>Nothing is playing yet. Choose media from Media Home.</p></main>
  return <main style={{ minHeight: '100vh', background: '#08090c', color: '#f7f7f8', fontFamily: 'system-ui, sans-serif' }}><div style={{ maxWidth: 1180, margin: '0 auto', padding: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Link href="/jhadinatv" style={{ color: '#aeb2bd', textDecoration: 'none' }}>← Media Home</Link><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Full player'}</button></div><section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: expanded ? '1fr 320px' : '1fr', gap: 20 }}><div><div style={{ aspectRatio: '16 / 9', background: '#111319', borderRadius: 18, overflow: 'hidden' }}>{current.artworkUrl && <img src={current.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div><h1>{current.title}</h1><p style={{ color: '#9da2ae' }}>{current.provider} · {current.kind} · Resume position {Math.floor(resume)}s</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" onClick={() => setResume(0)}>Restart</button><button type="button">Play / Pause</button><button type="button">Captions</button><button type="button">Audio</button><button type="button">Cast / Device</button></div></div>{expanded && <aside style={{ padding: 18, background: '#111319', borderRadius: 18 }}><h2>Up next</h2>{next ? <p>{next.title}</p> : <p style={{ color: '#9da2ae' }}>Queue is empty.</p>}<h2 style={{ marginTop: 28 }}>Queue</h2>{queue.map((item) => <div key={`${item.provider}:${item.id}`} style={{ padding: '10px 0', borderBottom: '1px solid #242832' }}>{item.title}</div>)}</aside>}</section></div></main>
}
