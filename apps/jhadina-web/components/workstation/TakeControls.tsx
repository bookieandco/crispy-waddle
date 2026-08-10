'use client';

import { useState } from 'react';

export function TakeControls({ projectId, sceneId, parentTakeId, onCandidates }: { projectId: string; sceneId: string; parentTakeId?: string; onCandidates?: (candidates: unknown[]) => void }) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const response = await fetch('/api/workstation/takes/batch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, sceneId, parentTakeId, prompt, count }) });
      const data = await response.json();
      if (response.ok) onCandidates?.(data.candidates ?? []);
    } finally { setBusy(false); }
  }

  return <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Direct the next takes… e.g. Make it funnier but keep the camera, lighting and character exactly the same." rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', background: '#0d0d10', color: 'inherit', border: '1px solid rgba(255,255,255,.12)', borderRadius: 12, padding: 12 }} />
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <label style={{ fontSize: 12, opacity: .6 }}>Takes</label>
      <select value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ background: '#222229', color: 'inherit', border: 0, borderRadius: 8, padding: 8 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <button type="button" disabled={busy || !prompt.trim()} onClick={generate} style={{ marginLeft: 'auto', padding: '9px 14px', borderRadius: 10, border: 0, cursor: 'pointer' }}>{busy ? 'Generating…' : `Generate ${count} takes`}</button>
    </div>
  </div>;
}
