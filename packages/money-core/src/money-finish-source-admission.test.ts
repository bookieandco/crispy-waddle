import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {admitMoneyResearchObservation, type MoneySourceReview} from './money-finish-source-admission.js';
import {MARKET_DATA_SOURCE_SCHEMA_VERSION,type MarketDataSourceContract} from './market-data-source-contracts.js';
import type {MarketObservationRecord} from './market-provenance-contracts.js';

const source:MarketDataSourceContract={
  schemaVersion:MARKET_DATA_SOURCE_SCHEMA_VERSION,sourceId:'read-only-test',providerName:'Independent fixture',
  sourceKind:'LICENSED_API',canonicalLocator:'https://example.org/terms',
  transports:['HTTP'],capabilities:['FOREX'],assetClasses:['FOREX'],pointInTimeSupport:'NATIVE_AVAILABLE_AT',
  supportsObservedAt:true,supportsAvailableAt:true,
  rights:{basis:'UPSTREAM_TERMS_REVIEW',termsLocator:'https://example.org/rights',evaluatedAt:'2026-10-08T00:00:00Z',
    research:'ALLOWED',modelTraining:'UNKNOWN',commercialInternal:'RESTRICTED',redistribution:'RESTRICTED',resale:'RESTRICTED',
    evidenceRefs:['independent-terms-review']},
  provenanceHash:'source-contract-hash',financialAuthority:'NONE'
};
const observation:MarketObservationRecord={
  observationId:'price-1',instrumentId:'EURUSD',provider:'read-only-test',observationType:'FOREX',
  value:'1.10',observedAt:'2026-10-08T10:00:00Z',receivedAt:'2026-10-08T10:00:01Z',
  availableAt:'2026-10-08T10:00:02Z',effectiveAt:'2026-10-08T10:00:00Z',
  qualityStatus:'VALID',evidenceRef:'price:1',provenanceHash:'price-hash'
};
const review:MoneySourceReview={reviewId:'licensed-vendor-rights-reviewed',codeClearance:'VERIFIED',
  reviewEvidenceIds:['contract:1'],allowedCapabilities:['FOREX']};
const sample={source,observation,review,cutoff:'2026-10-08T10:00:03Z',purpose:'RESEARCH' as const,requiredCapability:'FOREX'};
test('FINISH.04 admits only reviewed licensed research observations, without live authority',()=>{
  const r=admitMoneyResearchObservation(sample);
  assert.equal(r.admission,'RESEARCH_ONLY');assert.equal(r.canAuthorizeLive,false);
});
test('FINISH.04 refuses unknown rights, capability and code reference promotion',()=>{
  assert.throws(()=>admitMoneyResearchObservation({...sample,review:{...review,codeClearance:'UNKNOWN'}}),/SOURCE_REVIEW_NOT_VERIFIED/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,requiredCapability:'OPTIONS_CHAIN'}),/CAPABILITY_NOT_ADMITTED/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,source:{...source,sourceKind:'REFERENCE_CODE'}}),/REFERENCE_CODE/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,source:{...source,rights:{...source.rights,research:'UNKNOWN'}}}),/USE_NOT_ALLOWED/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,purpose:'MODEL_TRAINING'}),/USE_NOT_ALLOWED/);
});
test('FINISH.04 rejects future bars, fake provider, bad quality and missing availableAt',()=>{
  assert.throws(()=>admitMoneyResearchObservation({...sample,cutoff:'2026-10-08T10:00:01Z'}),/CHRONOLOGY/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,observation:{...observation,provider:'someone-else'}}),/SOURCE_OBSERVATION_MISMATCH/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,observation:{...observation,qualityStatus:'STALE'}}),/OBSERVATION_NOT_VALID/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,source:{...source,supportsAvailableAt:false}}),/NATIVE_SOURCE_AVAILABILITY/);
  assert.throws(()=>admitMoneyResearchObservation({...sample,observation:{...observation,observedAt:'invalid'}}),/OBSERVED_TIME_INVALID/);
});
test('FINISH.04 donor and provider registry cannot silently grant data-use rights',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../../../docs/architecture/MONEY-UPSTREAM-RIGHTS-REGISTRY.json',import.meta.url),'utf8')) as {
    schemaVersion:string;policy:string;items:{id:string;kind:string;marketDataRights:string;codeReview:string;pinnedSha:string|null}[]
  };
  assert.equal(manifest.schemaVersion,'MONEY-FINISH-04');
  assert.equal(manifest.policy,'UNREVIEWED_DENY');
  assert.equal(new Set(manifest.items.map(x=>x.id)).size,manifest.items.length);
  assert.ok(manifest.items.length>=10);
  assert.ok(manifest.items.every(x=>x.pinnedSha===null && x.codeReview!=='VERIFIED'));
  assert.ok(manifest.items.filter(x=>x.kind==='MARKET_FEED').every(x=>x.marketDataRights==='UNKNOWN'));
});
