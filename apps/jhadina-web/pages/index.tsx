'use client';

import React, { FormEvent, useEffect, useState } from 'react';

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
      const result = await getJson<{ data?: { systemResponse?: string } }>('/api/message');
      void result;
    } catch {
      // POST is handled separately below; this keeps the command center resilient.
    }

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
    <main style={{ minHeight: '100vh', background: '#0b0b0d', color: '#f5f5f5', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}>
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px 96px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '.28em', textTransform: 'uppercase', opacity: .42 }}>Jhadina Command Center</div>
            <h1 style={{ fontSize: 38, lineHeight: 1.05, margin: '10px 0 8px' }}>Your world, in one stream.</h1>
            <p style={{ margin: 0, lineHeight: 1.6, opacity: .52 }}>Awareness first. Decisions when needed. Control always. Every important action leaves a trail.</p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={health === 'LOADING'} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: health === 'LOADING' ? 'wait' : 'pointer' }}>
            {health === 'LOADING' ? 'Checking…' : 'Refresh'}
          </button>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 18 }}>
          <StatusCard label="System" value={healthLabel} />
          <StatusCard label="Pending decisions" value={String(pending)} />
          <StatusCard label="Approved memories" value={String(memories)} />
        </section>

        <form onSubmit={sendMessage} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 22, padding: 18, background: 'rgba(255,255,255,.035)', marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .45, marginBottom: 10 }}>Talk to Jhadina</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should we work on?" aria-label="Message Jhadina" style={{ flex: '1 1 280px', minWidth: 0, border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 14px', background: 'rgba(0,0,0,.22)', color: 'inherit', outline: 'none' }} />
            <button type="submit" disabled={sending || !message.trim()} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '12px 16px', background: 'rgba(255,255,255,.09)', color: 'inherit', cursor: sending ? 'wait' : 'pointer' }}>{sending ? 'Working…' : 'Send'}</button>
          </div>
          {response && <p style={{ margin: '12px 0 0', lineHeight: 1.55, opacity: .72 }}>{response}</p>}
        </form>

        <div style={{ display: 'grid', gap: 14 }}>
          {feed.map((item) => (
            <article key={`${item.label}-${item.title}`} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', boxShadow: '0 14px 50px rgba(0,0,0,.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', fontSize: 18 }}>{item.glyph}</div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.2em', opacity: .45 }}>{item.label}</div>
              </div>
              <h2 style={{ margin: '18px 0 8px', fontSize: 21 }}>{item.title}</h2>
              <p style={{ margin: 0, lineHeight: 1.6, opacity: .52 }}>{item.body}</p>
              {item.action && (item.href ? <a href={item.href} style={{ display: 'inline-block', marginTop: 18, border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', color: 'inherit', textDecoration: 'none', background: 'rgba(255,255,255,.06)' }}>{item.action}</a> : <button type="button" style={{ marginTop: 18, border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: 'pointer' }}>{item.action}</button>)}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.025)' }}>
      <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', opacity: .4 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 20 }}>{value}</div>
    </div>
  );
}
