import {describe,expect,it} from 'vitest';
import {
  GOOGLE_HOMEBASE_REQUIREMENTS,
  assessGoogleHomebaseProgress,
  type GoogleHomebaseReceipt,
} from './google-homebase-progress.js';

const HEAD='a'.repeat(40);
const NOW=new Date('2026-10-07T20:00:00.000Z');
const tick='2026-10-07T18:00:00.000Z';

describe('GOOGLE-HOMEBASE.4-.10 evidence-only acceptance',()=>{
  it('does not turn chat Drive auth or source code into machine commissioning',()=>{
    const report=assessGoogleHomebaseProgress([],HEAD,NOW);
    expect(report.stages).toHaveLength(7);
    expect(report.advisoryEvidenceComplete).toBe(false);
    expect(report.outstandingRequirements).toContain('WORKER_GOOGLE_OAUTH_VERIFIED');
    expect(report.outstandingRequirements).toContain('POSTGRES_DISPOSABLE_IMPORT_VERIFIED');
    expect(report.outstandingRequirements).toContain('AUTH_RLS_REALTIME_FALLBACK_PROVEN');
    expect(report.phoneIsControlOnly).toBe(true);
    expect(report.providerDecommissionAuthorized).toBe(false);
    expect(report.productionCutoverPerformed).toBe(false);
  });
  it('rejects mismatched head, fake blank receipts, future and stale evidence',()=>{
    const bad:GoogleHomebaseReceipt[]=[
      {kind:'EXACT_HEAD_CI_GREEN',receiptId:'ci-run',commitSha:'b'.repeat(40),observedAt:tick,trustedVerification:true},
      {kind:'WORKER_GOOGLE_OAUTH_VERIFIED',receiptId:'',observedAt:tick,trustedVerification:true},
      {kind:'DVC_SYNTHETIC_PUSH_PULL_VERIFIED',receiptId:'x',observedAt:'2026-10-08T00:00:00Z',trustedVerification:true},
      {kind:'POSTGRES_DISPOSABLE_IMPORT_VERIFIED',receiptId:'x',observedAt:'2025-10-07T18:00:00Z',trustedVerification:true},
      {kind:'NATS_RECOVERY_TESTED',receiptId:'x',observedAt:tick,trustedVerification:false},
    ];
    const report=assessGoogleHomebaseProgress(bad,HEAD,NOW);
    for(const r of bad)expect(report.outstandingRequirements).toContain(r.kind);
  });
  it('does not auto-cancel providers even when a trusted verifier supplies complete evidence',()=>{
    const kinds=Object.values(GOOGLE_HOMEBASE_REQUIREMENTS).flat();
    const records=kinds.map(kind=>({
      kind,receiptId:'proof-'+kind,observedAt:tick,trustedVerification:true,
      commitSha:kind==='EXACT_HEAD_CI_GREEN'?HEAD:undefined,
    }));
    const report=assessGoogleHomebaseProgress(records,HEAD,NOW);
    expect(report.advisoryEvidenceComplete).toBe(true);
    expect(report.outstandingRequirements).toEqual([]);
    expect(report.providerDecommissionAuthorized).toBe(false);
    expect(report.productionCutoverPerformed).toBe(false);
  });
  it('never accepts stale claims as live subsystem success',()=>{
    const stale:GoogleHomebaseReceipt={kind:'DIRECTOR_E2E_VERIFIED',receiptId:'test',observedAt:'2026-01-01T00:00:00Z',trustedVerification:true};
    expect(assessGoogleHomebaseProgress([stale],HEAD,NOW).outstandingRequirements).toContain('DIRECTOR_E2E_VERIFIED');
  });
});
