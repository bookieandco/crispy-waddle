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
  tone: string;
};

const feed: FeedItem[] = [
  { label: 'Jhadina', glyph: '✦', title: 'Your world, in one stream.', body: 'Social, music, opportunities, media, and Jhadina — mixed by context instead of trapped in separate apps.', tone: '#dfe7dc' },
  { label: 'Music', glyph: '♪', title: 'Your Music is ready.', body: 'Pick up where you left off or search for something new.', action: 'Open Music', href: '/music', tone: '#e7def0' },
  { label: 'Opportunity', glyph: '$', title: 'Something worth a look.', body: 'Opportunity intelligence will surface leads, ideas, and time-sensitive opportunities here.', action: 'Review', tone: '#dce7ed' },
  { label: 'Director', glyph: '▶', title: 'A new video is ready for review.', body: 'Creative output from your Director workspace can appear here before anything is published.', action: 'Watch', tone: '#efe3d6' },
  { label: 'YouTube', glyph: 'Y', title: 'Recommended video space.', body: 'Connected YouTube content can appear here once the account is authorized.', action: 'Connect', tone: '#e0e7df' },
  { label: 'Social', glyph: '◎', title: 'Your social world, mixed into the stream.', body: 'Facebook, Instagram, and TikTok cards will be pulled through authorized integrations — never scraped.', action: 'Connect', tone: '#e5dff0' },
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
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f5f1ea 0%, #eef2ee 52%, #f3eee8 100%)', color: '#27302c', fontFamily: 'ui-rounded, "Avenir Next", Avenir, "Trebuchet MS", system-ui, sans-serif', paddingBottom: 112 }}>
      <section style={{ maxWidth: 820, margin: '0 auto', padding: '26px 18px 72px' }}>
        <header style={{ marginBottom: 38, paddingTop: 10 }}>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: '#748078' }}>Jhadina</div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginTop: 10 }}>
            <h1 style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 'clamp(36px, 9vw, 62px)', lineHeight: .98, letterSpacing: '-.045em', color: '#27302c' }}>Your world,<br />in one stream.</h1>
            <button type="button" onClick={() => void refresh()} disabled={health === 'LOADING'} aria-label="Refresh Jhadina" style={{ flex: '0 0 auto', width: 44, height: 44, border: '1px solid #d5ddd6', borderRadius: '50%', background: 'rgba(255,255,255,.62)', color: '#4c5b52', cursor: health === 'LOADING' ? 'wait' : 'pointer', fontSize: 17, boxShadow: '0 8px 24px rgba(67,76,69,.08)' }}>
              {health === 'LOADING' ? '…' : '↻'}
            </button>
          </div>
          <p style={{ maxWidth: 560, margin: '17px 0 0', fontSize: 15, lineHeight: 1.72, color: '#718078' }}>Awareness first. Decisions when needed. Control always.</p>
        </header>

        <section aria-label="Jhadina status" style={{ display: 'flex', gap: 30, overflowX: 'auto', padding: '2px 4px 12px', margin: '0 -4px 34px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
          <Metric label="System" value={healthLabel} />
          <Metric label="Decisions" value={String(pending)} />
          <Metric label="Memories" value={String(memories)} />
          <Metric label="Mode" value="Personal" />
        </section>

        <form onSubmit={sendMessage} style={{ marginBottom: 42 }}>
          <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7a867f', marginBottom: 10 }}>Talk to Jhadina</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #d9dfda', borderRadius: 22, padding: '7px 8px 7px 16px', background: 'rgba(255,255,255,.58)', boxShadow: '0 12px 34px rgba(70,78,72,.06)' }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should we work on?" aria-label="Message Jhadina" style={{ flex: 1, minWidth: 0, border: 0, padding: '9px 0', background: 'transparent', color: '#27302c', outline: 'none', fontSize: 16 }} />
            <button type="submit" disabled={sending || !message.trim()} style={{ border: 0, borderRadius: 999, padding: '10px 16px', background: message.trim() ? '#34443c' : '#e2e7e3', color: message.trim() ? '#f8f6f1' : '#9aa39d', cursor: sending ? 'wait' : 'pointer', fontWeight: 600 }}>{sending ? '…' : 'Send'}</button>
          </div>
          {response && <p style={{ margin: '14px 4px 0', lineHeight: 1.6, color: '#68756e' }}>{response}</p>}
        </form>

        <div style={{ marginBottom: 42 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
            <h2 style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 25, letterSpacing: '-.025em' }}>Right now</h2>
            <span style={{ fontSize: 11, color: '#87928c' }}>swipe →</span>
          </div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', margin: '0 -18px', padding: '2px 18px 14px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {feed.slice(0, 3).map((item) => (
              <article key={`${item.label}-${item.title}`} style={{ flex: '0 0 min(78vw, 310px)', minHeight: 190, scrollSnapAlign: 'start', borderRadius: 28, padding: 22, background: item.tone, border: '1px solid rgba(70,80,73,.08)', boxShadow: '0 16px 38px rgba(67,76,69,.08)', transform: 'translateZ(0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#68766e', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase' }}><span style={{ fontSize: 16 }}>{item.glyph}</span>{item.label}</div>
                <h3 style={{ margin: '18px 0 8px', fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 24, lineHeight: 1.08, letterSpacing: '-.025em', color: '#2f3933' }}>{item.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.55, fontSize: 14, color: '#69766f' }}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 0 }}>
          {feed.slice(3).map((item) => (
            <article key={`${item.label}-${item.title}`} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 14, padding: '24px 4px', borderTop: '1px solid #dce2dd' }}>
              <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: item.tone, color: '#647169', fontSize: 15 }}>{item.glyph}</div>
              <div>
                <div style={{ color: '#7c8881', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase' }}>{item.label}</div>
                <h3 style={{ margin: '7px 0 6px', fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 22, lineHeight: 1.15, letterSpacing: '-.02em' }}>{item.title}</h3>
                <p style={{ margin: 0, maxWidth: 620, lineHeight: 1.65, fontSize: 14, color: '#707c75' }}>{item.body}</p>
                {item.action && (item.href ? <a href={item.href} style={{ display: 'inline-block', marginTop: 13, color: '#405047', textDecoration: 'none', fontSize: 13, fontWeight: 650 }}>{item.action} <span aria-hidden="true">→</span></a> : <button type="button" style={{ marginTop: 13, border: 0, padding: 0, background: 'none', color: '#405047', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>{item.action} <span aria-hidden="true">→</span></button>)}
              </div>
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
    <div style={{ flex: '0 0 auto', minWidth: 110, scrollSnapAlign: 'start' }}>
      <div style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#87928c' }}>{label}</div>
      <div style={{ marginTop: 6, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 18, fontWeight: 400, color: '#3d4942' }}>{value}</div>
    </div>
  );
}
