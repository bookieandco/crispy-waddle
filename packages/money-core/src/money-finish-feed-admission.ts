import { createHash } from 'node:crypto';
import { assertStockBar, assertStockQuote, assertStockCorporateAction,
  type StockBar, type StockQuote, type StockCorporateAction } from './stock-market-reality.js';
import { assertFxQuote, type FxQuote } from './fx-market-reality.js';
import { admitMoneyResearchObservation, type MoneySourceReview } from './money-finish-source-admission.js';
import type { MarketDataSourceContract } from './market-data-source-contracts.js';
import type { MarketObservationRecord } from './market-provenance-contracts.js';

export const MONEY_FINISH_FEED_SCHEMA = 'MONEY-FINISH-05' as const;
export type MoneyFeedAdmission = Readonly<{
  schemaVersion: typeof MONEY_FINISH_FEED_SCHEMA;
  asset: 'STOCK' | 'FOREX';
  instrumentId: string;
  sourceId: string;
  admittedObservationIds: readonly string[];
  evidenceIds: readonly string[];
  informationCutoff: string;
  disposition: 'RESEARCH_ONLY';
  canExecute: false;
  canAuthorizeLive: false;
}>;

const digest = (parts: unknown): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
function time(v: string, code: string): number {
  const n = Date.parse(v);
  if (!v || !Number.isFinite(n)) throw new Error(code);
  return n;
}
function ensureFresh(receivedAt: string, observedAt: string, cutoff: string, maxAgeMs: number): void {
  const end = time(cutoff, 'MONEY_FINISH_FEED_CUTOFF_INVALID');
  const available = time(receivedAt, 'MONEY_FINISH_FEED_RECEIVED_INVALID');
  const observed = time(observedAt, 'MONEY_FINISH_FEED_OBSERVED_INVALID');
  if (observed > available || available > end) throw new Error('MONEY_FINISH_FEED_FUTURE_OR_ORDER_INVALID');
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) throw new Error('MONEY_FINISH_FEED_AGE_POLICY_REQUIRED');
  if (end - observed > maxAgeMs) throw new Error('MONEY_FINISH_FEED_STALE');
}
function observe(x: Readonly<{
  id: string; instrumentId: string; sourceId: string; value: string;
  observedAt: string; availableAt: string; receivedAt: string;
  evidenceRef: string; provenanceHash: string;
}>): MarketObservationRecord {
  return {
    observationId:x.id, instrumentId:x.instrumentId, provider:x.sourceId,
    observationType:'MARKET_REFERENCE', value:x.value, observedAt:x.observedAt,
    effectiveAt:x.observedAt, availableAt:x.availableAt, receivedAt:x.receivedAt,
    qualityStatus:'VALID', evidenceRef:x.evidenceRef, provenanceHash:x.provenanceHash,
  };
}
export function admitStockMarketEvidence(input: Readonly<{
  source: MarketDataSourceContract; review: MoneySourceReview;
  instrumentId: string; bars: readonly StockBar[]; quote?: StockQuote;
  corporateActions: readonly StockCorporateAction[];
  corporateActionCoverage: 'VERIFIED' | 'UNKNOWN';
  corporateActionEvidenceIds: readonly string[];
  informationCutoff: string; quoteMaxAgeMs: number;
}>): MoneyFeedAdmission {
  const {source,review,informationCutoff:cutoff}=input;
  if (!input.instrumentId.trim() || !input.bars.length) throw new Error('MONEY_FINISH_STOCK_INPUT_REQUIRED');
  if (input.corporateActionCoverage!=='VERIFIED' || !input.corporateActionEvidenceIds.length) {
    throw new Error('MONEY_FINISH_STOCK_CORPORATE_ACTION_COVERAGE_UNKNOWN');
  }
  const earliest = Math.min(...input.bars.map(b=>time(b.startsAt,'MONEY_FINISH_STOCK_BAR_TIME_INVALID')));
  for (const action of input.corporateActions) {
    assertStockCorporateAction(action);
    if (action.status==='UNKNOWN' ||
        (['SPLIT','REVERSE_SPLIT','STOCK_DIVIDEND','MERGER','SPINOFF','SYMBOL_CHANGE'].includes(action.actionType) &&
        !action.effectiveAt && action.status!=='CANCELLED')) {
      throw new Error('MONEY_FINISH_STOCK_ACTION_EFFECTIVE_DATE_UNVERIFIED');
    }
    if (action.instrumentId!==input.instrumentId || action.provider!==source.sourceId ||
        time(action.availableAt,'MONEY_FINISH_STOCK_ACTION_TIME_INVALID')>time(cutoff,'MONEY_FINISH_STOCK_CUTOFF_INVALID')) {
      throw new Error('MONEY_FINISH_STOCK_ACTION_PROVENANCE_INVALID');
    }
  }
  const corporateDisruption = input.corporateActions.some(a =>
    ['SPLIT','REVERSE_SPLIT','STOCK_DIVIDEND','MERGER','SPINOFF','SYMBOL_CHANGE'].includes(a.actionType) &&
    a.status!=='CANCELLED' && a.effectiveAt &&
    time(a.effectiveAt,'MONEY_FINISH_STOCK_ACTION_EFFECTIVE_INVALID') >= earliest &&
    time(a.effectiveAt,'MONEY_FINISH_STOCK_ACTION_EFFECTIVE_INVALID') <= time(cutoff,'MONEY_FINISH_STOCK_CUTOFF_INVALID'));
  const admitted: string[]=[];
  let prior = -Infinity;
  for (const bar of input.bars) {
    assertStockBar(bar);
    if (bar.instrumentId!==input.instrumentId || bar.provider!==source.sourceId || bar.interval!=='1D') {
      throw new Error('MONEY_FINISH_STOCK_BAR_BINDING_INVALID');
    }
    const starts = time(bar.startsAt,'MONEY_FINISH_STOCK_BAR_START_INVALID');
    if (starts<=prior) throw new Error('MONEY_FINISH_STOCK_BAR_ORDER_OR_DUPLICATE');
    prior=starts;
    if (corporateDisruption && bar.adjustmentStatus!=='CANONICALLY_ADJUSTED' && bar.adjustmentStatus!=='SOURCE_ADJUSTED') {
      throw new Error('MONEY_FINISH_STOCK_UNADJUSTED_CORPORATE_ACTION');
    }
    const row=observe({id:bar.barId,instrumentId:bar.instrumentId,sourceId:source.sourceId,
      value:bar.close,observedAt:bar.observedAt,availableAt:bar.availableAt,receivedAt:bar.receivedAt,
      evidenceRef:bar.evidenceRef,provenanceHash:bar.provenanceHash});
    admitMoneyResearchObservation({source,review,observation:row,cutoff,purpose:'RESEARCH',requiredCapability:'CANDLES'});
    admitted.push(row.observationId);
  }
  if (input.quote) {
    const quote=input.quote; assertStockQuote(quote);
    if (quote.instrumentId!==input.instrumentId || quote.provider!==source.sourceId) throw new Error('MONEY_FINISH_STOCK_QUOTE_BINDING_INVALID');
    ensureFresh(quote.receivedAt,quote.observedAt,cutoff,input.quoteMaxAgeMs);
    admitMoneyResearchObservation({source,review,observation:observe({id:quote.quoteId,
      instrumentId:quote.instrumentId,sourceId:source.sourceId,value:quote.bidPrice,
      observedAt:quote.observedAt,availableAt:quote.availableAt,receivedAt:quote.receivedAt,
      evidenceRef:quote.evidenceRef,provenanceHash:quote.provenanceHash}),
      cutoff,purpose:'RESEARCH',requiredCapability:'LIVE_TICKS'});
    admitted.push(quote.quoteId);
  }
  return Object.freeze({schemaVersion:MONEY_FINISH_FEED_SCHEMA,asset:'STOCK',instrumentId:input.instrumentId,
    sourceId:source.sourceId,admittedObservationIds:Object.freeze(admitted),
    evidenceIds:Object.freeze([source.provenanceHash,...input.corporateActionEvidenceIds,
      ...input.bars.map(b=>b.evidenceRef),...(input.quote?[input.quote.evidenceRef]:[])].sort()),
    informationCutoff:cutoff,disposition:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
}

export function admitFxMarketQuote(input: Readonly<{
  source: MarketDataSourceContract; review: MoneySourceReview; quote: FxQuote;
  instrumentId: string; informationCutoff: string; maxAgeMs: number;
  sessionStatus: 'OPEN' | 'CLOSED' | 'HOLIDAY' | 'UNKNOWN';
  calendarEvidenceId: string;
}>): MoneyFeedAdmission {
  const {source,review,quote,informationCutoff:cutoff}=input;
  if (input.sessionStatus!=='OPEN' || !input.calendarEvidenceId.trim()) {
    throw new Error('MONEY_FINISH_FX_SESSION_OR_CALENDAR_UNVERIFIED');
  }
  assertFxQuote(quote);
  if (quote.provider!==source.sourceId || !input.instrumentId.trim() ||
      quote.sourceType!=='DIRECT' || quote.pairId!==input.instrumentId) {
    throw new Error('MONEY_FINISH_FX_QUOTE_PROVIDER_OR_PAIR_MISMATCH');
  }
  ensureFresh(quote.receivedAt,quote.observedAt,cutoff,input.maxAgeMs);
  const id='fx-quote:'+digest({quote:quote.quoteId,provider:source.sourceId,availableAt:quote.availableAt});
  admitMoneyResearchObservation({source,review,observation:observe({id,instrumentId:input.instrumentId,
    sourceId:source.sourceId,value:quote.bidPrice,observedAt:quote.observedAt,
    availableAt:quote.availableAt,receivedAt:quote.receivedAt,
    evidenceRef:quote.evidenceRefs[0]!,provenanceHash:quote.provenanceHash}),
    cutoff,purpose:'RESEARCH',requiredCapability:'FOREX'});
  return Object.freeze({schemaVersion:MONEY_FINISH_FEED_SCHEMA,asset:'FOREX',instrumentId:input.instrumentId,
    sourceId:source.sourceId,admittedObservationIds:Object.freeze([id]),
    evidenceIds:Object.freeze([source.provenanceHash,input.calendarEvidenceId,...quote.evidenceRefs].sort()),
    informationCutoff:cutoff,disposition:'RESEARCH_ONLY',canExecute:false,canAuthorizeLive:false});
}
