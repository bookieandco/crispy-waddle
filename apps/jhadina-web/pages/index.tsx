'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import BottomNav from '../components/BottomNav';

type Health = 'LOADING' | 'HEALTHY' | 'DEGRADED' | 'ERROR';

type FeedItem = {
  label: string;
  glyph: string;
  title: string;
  body: string;
  action?: string;
  href?: string;
};

const feed: FeedItem[] = [
  { label: 'Jhadina', glyph: '✦', title: 'Your world, in one stream.', body: 'Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.' },
  { label: 'Music', glyph: '♪', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', action: 'Open Music', href: '/music' },
  { label: 'Opportunity', glyph: '$', title: 'A business opportunity needs your attention.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', action: 'Review' },
  { label: 'Director', glyph: '▶', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', action: 'Watch' },
  { label: 'YouTube', glyph: 'Y', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', action: 'Connect' },
  { label: 'Social', glyph: '◎', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', action: 'Connect' },
];

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { headers: { 'x-user-id': 'user_demo' }, signal: controller.signal });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function Home() {
  const [health, setHealth] = useState<Health>('LOADING');
  const [pending, setPending] = useState(0);
  const [memories, setMemories] = useState(0);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    setHealth('LOADING');
    try {
      const [healthResult, candidateResult, memoryResult] = await Promise.all([
        getJson<{ status?: string }>('/api/health'),
        getJson<{ data?: { count?: number } }>('/api/candidates'),
        getJson<{ data?: { count?: number } }>('/api/memories'),
      ]);
      setHealth(healthResult.status === 'healthy' ? 'HEALTHY' : 'DEGRADED');
      setPending(candidateResult.data?.count ?? 0);
      setMemories(memoryResult.data?.count ?? 0);
    } catch {
      setHealth('ERROR');
    }
  };

  useEffect(() => { void refresh(); }, []);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setResponse('');

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-user-id': 'user_demo' },
        body: JSON.stringify({ message: message.trim() }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const result = await res.json() as { data?: { systemResponse?: string } };
      if (!res.ok) throw new Error('Message failed');
      setResponse(result.data?.systemResponse || 'Jhadina processed the message.');
      setMessage('');
      await refresh();
    } catch {
      setResponse('Jhadina is still connecting. Nothing was lost — try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const healthLabel = health === 'LOADING' ? 'Connecting' : health === 'HEALTHY' ? 'Healthy' : health === 'DEGRADED' ? 'Degraded' : 'Needs attention';

  return (
    <main style={{ minHeight: '100vh', background: '#0b0b0d', color: '#f5f5f5', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif', paddingBottom: 104 }}>
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 64px' }}>
        <header style={{ marginBottom: 46, paddingTop: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .38 }}>Jhadina</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginTop: 12 }}>
            <h1 style={{ margin: 0, fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 400, fontSize: 'clamp(34px, 8vw, 58px)', lineHeight: .98, letterSpacing: '-.035em' }}>Your world,<br />in one stream.</h1>
            <button type="button" onClick={() => void refresh()} disabled={health === 'LOADING'} aria-label="Refresh Jhadina" style={{ flex: '0 0 auto', width: 44, height: 44, border: '1px solid rgba(255,255,255,.1)', borderRadius: '50%', background: 'rgba(255,255,255,.05)', color: 'inherit', cursor: health === 'LOADING' ? 'wait' : 'pointer', fontSize: 17 }}>
              {health === 'LOADING' ? '…' : '↻'}
            </button>
          </div>
          <p style={{ maxWidth: 560, margin: '18px 0 0', fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,.55)' }}>Awareness first. Decisions when needed. Control always.</p>
        </header>

        <section style={{ display: 'flex', gap: 28, overflowX: 'auto', padding: '0 0 8px', marginBottom: 38, scrollbarWidth: 'none' }}>
          <Metric label="System" value={healthLabel} />
          <Metric label="Decisions" value={String(pending)} />
          <Metric label="Memories" value={String(memories)} />
        </section>

        <form onSubmit={sendMessage} style={{ marginBottom: 46 }}>
          <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .4, marginBottom: 12 }}>Talk to Jhadina</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,.18)', paddingBottom: 10 }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should we work on?" aria-label="Message Jhadina" style={{ flex: 1, minWidth: 0, border: 0, padding: '8px 0', background: 'transparent', color: 'inherit', outline: 'none', fontSize: 17 }} />
            <button type="submit" disabled={sending || !message.trim()} style={{ border: 0, borderRadius: 999, padding: '9px 15px', background: message.trim() ? '#f5f5f5' : 'rgba(255,255,255,.08)', color: message.trim() ? '#0b0b0d' : 'rgba(255,255,255,.3)', cursor: sending ? 'wait' : 'pointer', fontWeight: 600 }}>{sending ? '…' : 'Send'}</button>
          </div>
          {response && <p style={{ margin: '14px 0 0', lineHeight: 1.6, color: 'rgba(255,255,255,.68)' }}>{response}</p>}
        </form>

        <div style={{ display: 'grid', gap: 34 }}>
          {feed.map((item, index) => (
            <article key={`${item.label}-${item.title}`} style={{ paddingTop: index === 0 ? 0 : 30, borderTop: index === 0 ? 'none' : '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,.42)', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase' }}>
                <span style={{ fontSize: 16, opacity: .9 }}>{item.glyph}</span>{item.label}
              </div>
              <h2 style={{ margin: '13px 0 8px', fontFamily: 'Georgia, Times New Roman, serif', fontWeight: 400, fontSize: 25, lineHeight: 1.12, letterSpacing: '-.02em' }}>{item.title}</h2>
              <p style={{ margin: 0, maxWidth: 620, lineHeight: 1.7, fontSize: 15, color: 'rgba(255,255,255,.5)' }}>{item.body}</p>
              {item.action && (item.href ? <a href={item.href} style={{ display: 'inline-block', marginTop: 17, color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>{item.action} <span aria-hidden="true">→</span></a> : <button type="button" style={{ marginTop: 17, border: 0, padding: 0, background: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{item.action} <span aria-hidden="true">→</span></button>)}
            </article>
          ))}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '0 0 auto', minWidth: 110 }}>
      <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.34)' }}>{label}</div>
      <div style={{ marginTop: 6, fontFamily: 'Georgia, Times New Roman, serif', fontSize: 18, fontWeight: 400 }}>{value}</div>
    </div>
  );
}
