'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import BottomNav from '../components/BottomNav';

type Health = 'LOADING' | 'HEALTHY' | 'DEGRADED' | 'ERROR';
type Memory = { id: string; type: string; status: string; content: string; confidence: number; createdAt?: string };

type Candidate = Memory;

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

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { 'content-type': 'application/json', 'x-user-id': 'user_demo', ...(options?.headers || {}) },
      signal: controller.signal,
    });
    const result = await response.json() as { data?: T; error?: string };
    if (!response.ok) throw new Error(result.error || `Request failed: ${response.status}`);
    return result.data as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function Home() {
  const [health, setHealth] = useState<Health>('LOADING');
  const [pending, setPending] = useState<Candidate[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [sending, setSending] = useState(false);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setHealth('LOADING');
    try {
      const [healthResult, candidateResult, memoryResult] = await Promise.all([
        getJson<{ status?: string }>('/api/health'),
        getJson<{ candidates?: Candidate[]; count?: number }>('/api/candidates'),
        getJson<{ memories?: Memory[]; count?: number }>('/api/memories'),
      ]);
      setHealth(healthResult.status === 'ok' ? 'HEALTHY' : 'DEGRADED');
      setPending(candidateResult.candidates ?? []);
      setMemories(memoryResult.memories ?? []);
      setError('');
    } catch (err) {
      setHealth('ERROR');
      setError(err instanceof Error ? err.message : 'Could not connect to Jhadina');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    setResponse('');
    setError('');
    try {
      const result = await getJson<{
        reasoningEventId: string;
        candidateId: string;
        classification: { type: string; confidence: number };
        systemResponse: string;
        confidence: number;
      }>('/api/message', { method: 'POST', body: JSON.stringify({ message: message.trim() }) });
      setResponse(result.systemResponse || 'I processed that.');
      setMessage('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message failed');
    } finally {
      setSending(false);
    }
  };

  const decide = async (candidateId: string, action: 'approve' | 'reject') => {
    setDecisionId(candidateId);
    setError('');
    try {
      await getJson(action === 'approve' ? '/api/memory/approve' : '/api/memory/reject', {
        method: 'POST',
        body: JSON.stringify({ candidateId }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setDecisionId(null);
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
            <button type="button" onClick={() => void refresh()} disabled={health === 'LOADING'} aria-label="Refresh Jhadina" style={{ flex: '0 0 auto', width: 44, height: 44, border: '1px solid #d5ddd6', borderRadius: '50%', background: 'rgba(255,255,255,.62)', color: '#4c5b52', cursor: health === 'LOADING' ? 'wait' : 'pointer', fontSize: 17, boxShadow: '0 8px 24px rgba(67,76,69,.08)' }}>{health === 'LOADING' ? '…' : '↻'}</button>
          </div>
          <p style={{ maxWidth: 560, margin: '17px 0 0', fontSize: 15, lineHeight: 1.72, color: '#718078' }}>Awareness first. Decisions when needed. Control always.</p>
        </header>

        <section aria-label="Jhadina status" style={{ display: 'flex', gap: 30, overflowX: 'auto', padding: '2px 4px 12px', margin: '0 -4px 34px', scrollbarWidth: 'none', scrollSnapType: 'x proximity' }}>
          <Metric label="System" value={healthLabel} />
          <Metric label="Decisions" value={String(pending.length)} />
          <Metric label="Memories" value={String(memories.length)} />
          <Metric label="Mode" value="Personal" />
        </section>

        <form onSubmit={sendMessage} style={{ marginBottom: 34 }}>
          <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7a867f', marginBottom: 10 }}>Talk to Jhadina</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #d9dfda', borderRadius: 22, padding: '7px 8px 7px 16px', background: 'rgba(255,255,255,.58)', boxShadow: '0 12px 34px rgba(70,78,72,.06)' }}>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should we work on?" aria-label="Message Jhadina" style={{ flex: 1, minWidth: 0, border: 0, padding: '9px 0', background: 'transparent', color: '#27302c', outline: 'none', fontSize: 16 }} />
            <button type="submit" disabled={sending || !message.trim()} style={{ border: 0, borderRadius: 999, padding: '10px 16px', background: message.trim() ? '#34443c' : '#e2e7e3', color: message.trim() ? '#f8f6f1' : '#9aa39d', cursor: sending ? 'wait' : 'pointer', fontWeight: 600 }}>{sending ? '…' : 'Send'}</button>
          </div>
          {response && <p style={{ margin: '14px 4px 0', lineHeight: 1.6, color: '#68756e' }}>{response}</p>}
          {error && <p role="alert" style={{ margin: '12px 4px 0', lineHeight: 1.5, color: '#9b625a', fontSize: 13 }}>{error}</p>}
        </form>

        {pending.length > 0 && (
          <section style={{ marginBottom: 42 }} aria-label="Pending approvals">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
              <h2 style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 25, letterSpacing: '-.025em' }}>Needs your call</h2>
              <span style={{ fontSize: 11, color: '#87928c' }}>{pending.length} waiting</span>
            </div>
            {pending.slice(0, 3).map((candidate) => (
              <article key={candidate.id} style={{ marginBottom: 12, padding: 19, borderRadius: 23, background: 'rgba(255,255,255,.7)', border: '1px solid #dce2dd', boxShadow: '0 12px 34px rgba(70,78,72,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#7a6d90' }}>{candidate.type}</span>
                  <span style={{ fontSize: 11, color: '#87928c' }}>{Math.round(candidate.confidence * 100)}% confidence</span>
                </div>
                <p style={{ margin: '12px 0 16px', fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 20, lineHeight: 1.35 }}>{candidate.content}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => void decide(candidate.id, 'approve')} disabled={decisionId === candidate.id} style={primaryButton}>{decisionId === candidate.id ? 'Saving…' : 'Remember this'}</button>
                  <button type="button" onClick={() => void decide(candidate.id, 'reject')} disabled={decisionId === candidate.id} style={secondaryButton}>Not this</button>
                </div>
              </article>
            ))}
          </section>
        )}

        <section style={{ marginBottom: 42 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
            <h2 style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 25, letterSpacing: '-.025em' }}>Your memory</h2>
            <span style={{ fontSize: 11, color: '#87928c' }}>{memories.length} approved</span>
          </div>
          {memories.length === 0 ? <div style={{ padding: '22px 4px', color: '#7a867f', fontSize: 14, lineHeight: 1.6 }}>Nothing approved yet. Tell Jhadina something about you and she’ll ask before remembering it.</div> : memories.slice(0, 4).map((memory) => (
            <article key={memory.id} style={{ padding: '17px 4px', borderTop: '1px solid #dce2dd' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#7a867f' }}>{memory.type}</span><span style={{ fontSize: 10, color: '#98a19c' }}>{Math.round(memory.confidence * 100)}%</span></div>
              <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.55, color: '#58655e' }}>{memory.content}</p>
            </article>
          ))}
        </section>

        <div style={{ marginBottom: 42 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, padding: '0 4px' }}>
            <h2 style={{ margin: 0, fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 25, letterSpacing: '-.025em' }}>Right now</h2>
            <span style={{ fontSize: 11, color: '#87928c' }}>swipe →</span>
          </div>
          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', margin: '0 -18px', padding: '2px 18px 14px', scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
            {feed.slice(0, 3).map((item) => (
              <article key={`${item.label}-${item.title}`} style={{ flex: '0 0 min(78vw, 310px)', minHeight: 190, scrollSnapAlign: 'start', borderRadius: 28, padding: 22, background: item.tone, border: '1px solid rgba(70,80,73,.08)', boxShadow: '0 16px 38px rgba(67,76,69,.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#68766e', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase' }}><span style={{ fontSize: 16 }}>{item.glyph}</span>{item.label}</div>
                <h3 style={{ margin: '18px 0 8px', fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 24, lineHeight: 1.08, letterSpacing: '-.025em', color: '#2f3933' }}>{item.title}</h3>
                <p style={{ margin: 0, lineHeight: 1.55, fontSize: 14, color: '#69766f' }}>{item.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid' }}>
          {feed.slice(3).map((item) => (
            <article key={`${item.label}-${item.title}`} style={{ display: 'grid', gridTemplateColumns: '38px 1fr', gap: 14, padding: '24px 4px', borderTop: '1px solid #dce2dd' }}>
              <div style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '50%', background: item.tone, color: '#647169', fontSize: 15 }}>{item.glyph}</div>
              <div><div style={{ color: '#7c8881', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase' }}>{item.label}</div><h3 style={{ margin: '7px 0 6px', fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: 22, lineHeight: 1.15, letterSpacing: '-.02em' }}>{item.title}</h3><p style={{ margin: 0, maxWidth: 620, lineHeight: 1.65, fontSize: 14, color: '#707c75' }}>{item.body}</p>{item.action && (item.href ? <a href={item.href} style={{ display: 'inline-block', marginTop: 13, color: '#405047', textDecoration: 'none', fontSize: 13, fontWeight: 650 }}>{item.action} →</a> : <button type="button" style={{ marginTop: 13, border: 0, padding: 0, background: 'none', color: '#405047', fontSize: 13, fontWeight: 650 }}>{item.action} →</button>)}</div>
            </article>
          ))}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}

const primaryButton: React.CSSProperties = { border: 0, borderRadius: 999, padding: '10px 15px', background: '#34443c', color: '#f8f6f1', fontWeight: 650, fontSize: 12 };
const secondaryButton: React.CSSProperties = { border: '1px solid #d5ddd7', borderRadius: 999, padding: '10px 15px', background: 'rgba(255,255,255,.72)', color: '#53615a', fontWeight: 650, fontSize: 12 };

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={{ flex: '0 0 auto', minWidth: 110, scrollSnapAlign: 'start' }}><div style={{ fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', color: '#87928c' }}>{label}</div><div style={{ marginTop: 6, fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 18, fontWeight: 400, color: '#3d4942' }}>{value}</div></div>;
}
