import React from 'react';
import type { PreparedPostDraft } from '../../src/lib/personal-feed/action-preparation';

interface Props {
  draft: PreparedPostDraft;
  onApprove: (draft: PreparedPostDraft) => void;
  onReject: (draft: PreparedPostDraft) => void;
  onClose: () => void;
}

export function PreparedPostPreview({ draft, onApprove, onReject, onClose }: Props) {
  return <div role="dialog" aria-modal="true" aria-labelledby={`prepared-post-${draft.actionId}`} style={{ marginTop: 14, padding: 18, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.18)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><div><div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .45 }}>Prepared post · approval required</div><h4 id={`prepared-post-${draft.actionId}`} style={{ margin: '8px 0 0', fontSize: 18 }}>Review before posting</h4></div><button type="button" onClick={onClose} aria-label="Close prepared post preview" style={{ border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', opacity: .55 }}>×</button></div>
    <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Platforms</div><p style={{ margin: '5px 0 0', opacity: .7 }}>{draft.platforms.join(' · ')}</p></div>
    <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Caption</div><p style={{ margin: '5px 0 0', lineHeight: 1.5, whiteSpace: 'pre-wrap', opacity: .78 }}>{draft.caption || 'No caption prepared yet.'}</p></div>
    <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Media</div><p style={{ margin: '5px 0 0', opacity: .55 }}>{draft.media.length ? `${draft.media.length} media item(s) prepared` : 'No media attached yet.'}</p></div>
    <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Why</div><p style={{ margin: '5px 0 0', opacity: .65 }}>{draft.why}</p></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}><button type="button" onClick={() => onApprove(draft)} style={{ border: '1px solid rgba(255,255,255,.18)', borderRadius: 11, padding: '9px 14px', background: 'rgba(255,255,255,.12)', color: 'inherit', cursor: 'pointer' }}>Approve</button><button type="button" onClick={() => onReject(draft)} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 11, padding: '9px 14px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Reject</button></div>
  </div>;
}
