import React from 'react';

export type ActionPreviewState = 'pending' | 'approved' | 'rejected';

export interface FeedActionPreview {
  id: string;
  title: string;
  why: string;
  changes: string[];
  sourceItemId: string;
  state: ActionPreviewState;
  requiresApproval: true;
}

interface Props {
  preview: FeedActionPreview;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
}

export function ActionPreview({ preview, onApprove, onReject, onClose }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={`action-preview-${preview.id}`} style={{ position: 'relative', marginTop: 14, padding: 18, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(0,0,0,.18)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .45 }}>Prepared action · approval required</div>
          <h4 id={`action-preview-${preview.id}`} style={{ margin: '8px 0 0', fontSize: 18 }}>{preview.title}</h4>
        </div>
        <button type="button" onClick={onClose} aria-label="Close action preview" style={{ border: 0, background: 'transparent', color: 'inherit', opacity: .55, cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>
      <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Why</div><p style={{ margin: '5px 0 0', lineHeight: 1.5, opacity: .7 }}>{preview.why}</p></div>
      <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .4 }}>Exact changes</div><ul style={{ margin: '7px 0 0', paddingLeft: 20, opacity: .7 }}>{preview.changes.map((change) => <li key={change} style={{ marginBottom: 5 }}>{change}</li>)}</ul></div>
      {preview.state === 'pending' ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}><button type="button" onClick={() => onApprove(preview.id)} style={{ border: '1px solid rgba(255,255,255,.18)', borderRadius: 11, padding: '9px 14px', background: 'rgba(255,255,255,.12)', color: 'inherit', cursor: 'pointer' }}>Approve</button><button type="button" onClick={() => onReject(preview.id)} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 11, padding: '9px 14px', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>Reject</button></div> : <div style={{ marginTop: 16, fontSize: 12, opacity: .5 }}>Status: {preview.state}</div>}
    </div>
  );
}
