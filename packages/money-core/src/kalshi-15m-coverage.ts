/**
 * JHADINA-KALSHI.06.05 — derived coverage ONLY; never creates a forecast.
 * Unobserved checkpoints live here, not in the immutable prediction journal.
 */
import {createHash} from 'node:crypto';
import {
  KALSHI_STUDY_SCHEMA, KALSHI_PREDICTION_HORIZONS_SEC,
  type Kalshi15mMarket, type KalshiStudyReceipt,
} from './kalshi-15m-study-recorder.js';

export type KalshiCoverageStatus = 'RECORDED' | 'ABSTAINED' | 'NOT_OBSERVED';
export type KalshiCoverageScope = 'SYNTHETIC_TEST' | 'PROVIDER_VERIFIED';
export type KalshiCoverageRow = Readonly<{
  id: string;
  marketTicker: string;
  horizonSeconds: number;
  checkpointAt: string;
  observedAt: string | null;
  receiptHash: string | null;
  status: KalshiCoverageStatus;
  outcomeStatus: 'PENDING_SETTLEMENT' | 'NOT_OBSERVED';
}>;
export type KalshiCoverageReport = Readonly<{
  schema: 'JHADINA-KALSHI-06-COVERAGE';
  scope: KalshiCoverageScope;
  expected: number;
  recorded: number;
  abstained: number;
  notObserved: number;
  verifiedSettlements: 0;
  rows: readonly KalshiCoverageRow[];
}>;

function receiptValid(r:KalshiStudyReceipt):boolean {
  const {observationHash,...body}=r;
  return r.schema===KALSHI_STUDY_SCHEMA &&
    r.paperOnly===true && r.canSubmitOrders===false &&
    r.settlementStatus==='PENDING' && r.officialOutcome===null &&
    r.officialSettlementValueUsd===null &&
    r.id===r.marketTicker+':'+r.horizonSeconds &&
    createHash('sha256').update(JSON.stringify(body)).digest('hex')===observationHash;
}

/**
 * A provider-verified scope is an INPUT assertion that must be backed by
 * upstream market metadata. It is never inferred from a ticker or screenshot.
 * Report entries are projections: NOT_OBSERVED is not a fabricated receipt.
 */
export function projectKalshiStudyCoverage(input:Readonly<{
  scope:KalshiCoverageScope;
  markets:readonly Kalshi15mMarket[];
  receipts:readonly KalshiStudyReceipt[];
}>):KalshiCoverageReport {
  if(input.scope!=='SYNTHETIC_TEST' && input.scope!=='PROVIDER_VERIFIED')
    throw new Error('KALSHI_COVERAGE_SCOPE_INVALID');
  const markets=new Map<string,Kalshi15mMarket>();
  for(const m of input.markets){
    if(!/^KXBTC15M-[A-Za-z0-9-]+$/.test(m.ticker) ||
      !Number.isFinite(m.closesAtMs) || m.closesAtMs<=0 ||
      !Number.isFinite(m.targetUsd) || m.targetUsd<=0 ||
      !/^[0-9a-f]{64}$/.test(m.providerEvidenceHash) ||
      !m.rulesPrimary?.trim() || markets.has(m.ticker))
      throw new Error('KALSHI_COVERAGE_MARKET_INVALID');
    markets.set(m.ticker,m);
  }
  const actual=new Map<string,KalshiStudyReceipt>();
  for(const r of input.receipts){
    const m=markets.get(r.marketTicker);
    if(!m || !receiptValid(r) || r.marketEvidenceHash!==m.providerEvidenceHash ||
      !KALSHI_PREDICTION_HORIZONS_SEC.some(h=>h===r.horizonSeconds) ||
      actual.has(r.id))
      throw new Error('KALSHI_COVERAGE_RECEIPT_INVALID');
    const checkpoint=m.closesAtMs-r.horizonSeconds*1000;
    const received=Date.parse(r.observedAt);
    if(r.checkpointAt!==new Date(checkpoint).toISOString() ||
      !Number.isFinite(received) || received<checkpoint || received>checkpoint+5000 ||
      r.closesAt!==new Date(m.closesAtMs).toISOString())
      throw new Error('KALSHI_COVERAGE_RECEIPT_TIMING_INVALID');
    actual.set(r.id,r);
  }
  const rows:KalshiCoverageRow[]=[];
  for(const m of [...markets.values()].sort((a,b)=>
    a.closesAtMs-b.closesAtMs || a.ticker.localeCompare(b.ticker))){
    for(const h of KALSHI_PREDICTION_HORIZONS_SEC){
      const id=m.ticker+':'+h, r=actual.get(id);
      rows.push(Object.freeze({
        id,marketTicker:m.ticker,horizonSeconds:h,
        checkpointAt:new Date(m.closesAtMs-h*1000).toISOString(),
        observedAt:r?.observedAt??null,
        receiptHash:r?.observationHash??null,
        status:!r?'NOT_OBSERVED':r.direction==='ABSTAIN'?'ABSTAINED':'RECORDED',
        outcomeStatus:r?'PENDING_SETTLEMENT':'NOT_OBSERVED',
      }));
    }
  }
  const result:KalshiCoverageReport={
    schema:'JHADINA-KALSHI-06-COVERAGE',scope:input.scope,
    expected:rows.length,recorded:rows.filter(r=>r.status==='RECORDED').length,
    abstained:rows.filter(r=>r.status==='ABSTAINED').length,
    notObserved:rows.filter(r=>r.status==='NOT_OBSERVED').length,
    verifiedSettlements:0,rows:Object.freeze(rows),
  };
  return Object.freeze(result);
}
