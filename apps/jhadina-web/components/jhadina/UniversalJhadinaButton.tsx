'use client';

import { useState } from 'react';
import { dispatchJhadinaCommand, type JhadinaResult } from '../../lib/jhadina/command-bus';

export function UniversalJhadinaButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<JhadinaResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await dispatchJhadinaCommand({
        id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
        text: value,
        source: 'button',
        surface: 'unknown',
        createdAt: new Date().toISOString(),
      });
      setResult(response);
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" aria-label="Ask Jhadina" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, border: '1px solid rgba(255,255,255,.16)', borderRadius: 999, padding: '13px 18px', background: 'rgba(20,20,24,.94)', color: 'inherit', boxShadow: '0 12px 40px rgba(0,0,0,.28)', cursor: 'pointer' }}>
      ✦ Jhadina
    </button>
    {open && <div role="dialog" aria-modal="true" aria-label="Jhadina command" style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'end center', padding: 20 }} onClick={() => setOpen(false)}>
      <section onClick={(event) => event.stopPropagation()} style={{ width: 'min(720px, 100%)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 24, padding: 20, background: 'rgba(22,22,26,.98)', boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}>
        <div style={{ fontSize: 12, opacity: .5, letterSpacing: '.18em', textTransform: 'uppercase' }}>Jhadina</div>
        <h2 style={{ margin: '8px 0 6px' }}>What’s the deal, foolie?</h2>
        <p style={{ margin: '0 0 16px', opacity: .55 }}>Ask for anything available through Jhadina.</p>
        <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') void submit(); }} placeholder="Make a faceless video about this…" rows={4} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 16, border: '1px solid rgba(255,255,255,.12)', padding: 14, background: 'rgba(255,255,255,.05)', color: 'inherit', font: 'inherit' }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
          <button type="button" onClick={() => setOpen(false)} style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '9px 14px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Close</button>
          <button type="button" disabled={!text.trim() || busy} onClick={() => void submit()} style={{ border: 0, borderRadius: 12, padding: '9px 16px', background: 'white', color: 'black', cursor: 'pointer', opacity: !text.trim() || busy ? .5 : 1 }}>{busy ? 'Working…' : 'Ask Jhadina'}</button>
        </div>
        {result && <div aria-live="polite" style={{ marginTop: 16, borderRadius: 14, padding: 14, background: 'rgba(255,255,255,.05)' }}><strong>{result.status}</strong><div style={{ marginTop: 5, opacity: .7 }}>{result.message}</div></div>}
      </section>
    </div>}
  </>;
}
