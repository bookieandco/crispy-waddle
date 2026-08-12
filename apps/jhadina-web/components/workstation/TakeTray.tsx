'use client';

import { useState } from 'react';

type Candidate = { takeId?: string; id?: string; takeNumber?: number; rank?: number; status?: 'candidate' | 'selected' | 'rejected'; previewUri?: string; thumbnailUri?: string; score?: number; changed?: string[]; reasons?: string[]; variation?: string };

export function TakeTray({ projectId, sceneId, candidates, onSelected }: { projectId: string; sceneId: string; candidates: Candidate[]; onSelected?: (takeId: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function selectTake(takeId: string) {
    setBusy(takeId);
    const response = await fetch('/api/workstation/takes/select', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, sceneId, takeId }) });
    setBusy(null);
    if (response.ok) onSelected?.(takeId);
  }
  const ranked = [...candidates].sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER));
  return <section style={{ marginTop: 18 }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .45, marginBottom: 10 }}>Candidate takes · ranked by continuity</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 12 }}>
      {ranked.map((take, index) => { const takeId = take.takeId ?? take.id ?? `candidate-${index}`; return <article key={takeId} style={{ position: 'relative', border: take.status === 'selected' ? '2px solid #fff' : '1px solid rgba(255,255,255,.1)', borderRadius: 14, overflow: 'hidden', background: '#111115' }}>
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, padding: '4px 7px', borderRadius: 7, background: 'rgba(0,0,0,.75)', fontSize: 11 }}>#{take.rank ?? index + 1} · {take.score ?? 0}%</div>
        <div style={{ aspectRatio: '16/9', background: '#202026', display: 'grid', placeItems: 'center', fontSize: 12, opacity: .7 }}>{take.previewUri ? <video src={take.previewUri} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : take.thumbnailUri ? <img src={take.thumbnailUri} alt="Take preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Preview pending'}</div>
        <div style={{ padding: 10 }}><strong>Take {take.takeNumber ?? take.rank ?? index + 1}</strong>{take.variation && <span style={{ float: 'right', fontSize: 11, opacity: .55 }}>{take.variation}</span>}<div style={{ fontSize: 11, opacity: .6, margin: '7px 0' }}>{take.reasons?.[0] ?? (take.changed?.length ? `Changed: ${take.changed.join(', ')}` : 'All locked dimensions match.')}</div><button disabled={busy === takeId} onClick={() => selectTake(takeId)} style={{ width: '100%', padding: 8, borderRadius: 9, border: 0, cursor: 'pointer' }}>{busy === takeId ? 'Selecting…' : take.status === 'selected' ? 'Selected' : 'Use this take'}</button></div>
      </article>; })}
    </div>
  </section>;
}
