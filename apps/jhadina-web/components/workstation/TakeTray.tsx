'use client';

import { useState } from 'react';

type Candidate = { id: string; takeNumber: number; status: 'candidate' | 'selected' | 'rejected'; previewUri?: string; score?: number; changed?: string[] };

export function TakeTray({ projectId, sceneId, candidates, onSelected }: { projectId: string; sceneId: string; candidates: Candidate[]; onSelected?: (takeId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function selectTake(takeId: string) {
    setBusy(takeId);
    const response = await fetch('/api/workstation/takes/select', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, sceneId, takeId }) });
    setBusy(null);
    if (response.ok) onSelected?.(takeId);
  }
  return <section style={{ marginTop: 18 }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .45, marginBottom: 10 }}>Candidate takes</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
      {candidates.map((take) => <article key={take.id} style={{ border: take.status === 'selected' ? '2px solid #fff' : '1px solid rgba(255,255,255,.1)', borderRadius: 14, overflow: 'hidden', background: '#111115' }}>
        <div style={{ aspectRatio: '16/9', background: '#202026', display: 'grid', placeItems: 'center', fontSize: 12, opacity: .7 }}>{take.previewUri ? <video src={take.previewUri} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Preview pending'}</div>
        <div style={{ padding: 10 }}><strong>Take {take.takeNumber}</strong>{take.score != null && <span style={{ float: 'right' }}>{take.score}%</span>}<div style={{ fontSize: 11, opacity: .55, margin: '7px 0' }}>{take.changed?.length ? `Changed: ${take.changed.join(', ')}` : 'Continuity match'}</div><button disabled={busy === take.id} onClick={() => selectTake(take.id)} style={{ width: '100%', padding: 8, borderRadius: 9, border: 0, cursor: 'pointer' }}>{busy === take.id ? 'Selecting…' : take.status === 'selected' ? 'Selected' : 'Use this take'}</button></div>
      </article>)}
    </div>
  </section>;
}
