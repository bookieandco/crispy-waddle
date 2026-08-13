'use client';

import React, { useState } from 'react';
import { planJhadinaCommand, type JhadinaCommandContext } from '../../lib/jhadina-command-router';

export function JhadinaCommandButton({ context = {} }: { context?: JhadinaCommandContext }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ReturnType<typeof planJhadinaCommand> | null>(null);

  function submit() {
    if (!text.trim()) return;
    setPlan(planJhadinaCommand(text, context));
  }

  return <>
    <button type="button" aria-label="Ask Jhadina" onClick={() => setOpen(true)} style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 1000, width: 58, height: 58, borderRadius: 29, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(20,20,24,.92)', color: 'inherit', boxShadow: '0 14px 40px rgba(0,0,0,.35)', cursor: 'pointer', fontSize: 24 }}>✦</button>
    {open && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'end center', padding: 22 }}>
      <section style={{ width: 'min(720px, 100%)', borderRadius: 28, padding: 24, background: '#17171b', border: '1px solid rgba(255,255,255,.1)', boxShadow: '0 30px 100px rgba(0,0,0,.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong>Jhadina</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
        <p style={{ opacity: .55 }}>Tell me what you want to do. I’ll use the current screen, selection, scene, video, campaign, and project context when available.</p>
        <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(); }} placeholder="Make a faceless video about this…" rows={4} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 16, padding: 14, background: 'rgba(255,255,255,.05)', color: 'inherit', border: '1px solid rgba(255,255,255,.1)' }} />
        <button type="button" onClick={submit} style={{ marginTop: 12, borderRadius: 14, padding: '11px 16px', border: 0, cursor: 'pointer' }}>Run with Jhadina</button>
        {plan && <div style={{ marginTop: 18, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 18 }}><div style={{ fontSize: 12, opacity: .5, textTransform: 'uppercase', letterSpacing: '.14em' }}>{plan.intent}</div><ol>{plan.steps.map((step) => <li key={step}>{step}</li>)}</ol>{plan.requiresApproval && <p><strong>Approval required</strong> — this command can perform an external action.</p>}</div>}
      </section>
    </div>}
  </>;
}
