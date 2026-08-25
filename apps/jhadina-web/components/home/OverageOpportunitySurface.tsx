import React from 'react';
import type { Opportunity } from '../../src/lib/opportunities/sideIncome';

type Surface = 'overview' | 'evidence' | 'property' | 'claim' | 'research' | 'action';

export interface OverageOpportunitySurfaceProps {
  opportunity: Opportunity;
  activeSurface?: Surface;
  onSurfaceChange?: (surface: Surface) => void;
  onPrepareResearch?: (opportunity: Opportunity) => void;
}

const surfaces: Surface[] = ['overview', 'evidence', 'property', 'claim', 'research', 'action'];

export function OverageOpportunitySurface({ opportunity, activeSurface = 'overview', onSurfaceChange, onPrepareResearch }: OverageOpportunitySurfaceProps) {
  const surfaceIndex = surfaces.indexOf(activeSurface);
  const setSurface = (surface: Surface) => onSurfaceChange?.(surface);

  return (
    <article aria-label={`OverageOS opportunity: ${opportunity.title}`} style={{ border: '1px solid rgba(255,255,255,.09)', borderRadius: 24, padding: 22, background: 'rgba(255,255,255,.035)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', opacity: .45 }}>Opportunity · OverageOS</div>
          <h3 style={{ margin: '9px 0 5px', fontSize: 21 }}>{opportunity.title}</h3>
          <p style={{ margin: 0, opacity: .55, lineHeight: 1.5 }}>{opportunity.summary}</p>
        </div>
        <div style={{ fontSize: 11, whiteSpace: 'nowrap', opacity: .6 }}>{opportunity.verificationStatus === 'verified' ? 'Verified' : 'Human review'}</div>
      </div>

      <div role="tablist" aria-label="Opportunity context" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '18px 2px 8px', scrollbarWidth: 'none' }}>
        {surfaces.map((surface) => (
          <button key={surface} type="button" role="tab" aria-selected={surface === activeSurface} onClick={() => setSurface(surface)} style={{ flex: '0 0 auto', border: '1px solid rgba(255,255,255,.1)', borderRadius: 999, padding: '8px 12px', background: surface === activeSurface ? 'rgba(255,255,255,.12)' : 'transparent', color: 'inherit', cursor: 'pointer', textTransform: 'capitalize' }}>
            {surface}
          </button>
        ))}
      </div>

      <div aria-live="polite" style={{ minHeight: 120, padding: 16, borderRadius: 18, background: 'rgba(0,0,0,.16)' }}>
        {activeSurface === 'overview' && <SurfaceText title="Overview" body={opportunity.summary} />}
        {activeSurface === 'evidence' && <SurfaceText title="Evidence" body={`${opportunity.sourceName}. Source confidence: ${Math.round((opportunity.sourceConfidence ?? 0) * 100)}%. ${opportunity.riskFlags.length ? `Risk flags: ${opportunity.riskFlags.join(', ')}.` : 'No risk flags supplied.'}`} />}
        {activeSurface === 'property' && <SurfaceText title="Property / asset" body="Property details are shown only when supplied by the source record. No ownership or entitlement is inferred here." />}
        {activeSurface === 'claim' && <SurfaceText title="Claim / verification" body={`Verification status: ${opportunity.verificationStatus ?? 'human_required'}. Discovery does not establish eligibility or entitlement.`} />}
        {activeSurface === 'research' && <SurfaceText title="Research" body="Prepare a research action to inspect the source, evidence, property, and verification requirements before pursuing the opportunity." />}
        {activeSurface === 'action' && <SurfaceText title="Action" body="External actions remain user-approved. Preparing an action does not execute it." />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        <div style={{ fontSize: 11, opacity: .4 }}>{surfaceIndex + 1} / {surfaces.length}</div>
        {activeSurface === 'research' && <button type="button" onClick={() => onPrepareResearch?.(opportunity)} style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,.08)', color: 'inherit', cursor: 'pointer' }}>Prepare research</button>}
      </div>
    </article>
  );
}

function SurfaceText({ title, body }: { title: string; body: string }) {
  return <div><div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .42 }}>{title}</div><p style={{ margin: '8px 0 0', lineHeight: 1.55, opacity: .68 }}>{body}</p></div>;
}
