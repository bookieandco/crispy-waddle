import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertMetalDefinition,
  buildMetalMarketSnapshot,
  type MetalInstrumentDefinition,
  type MetalQuote,
} from './metals-market-reality.js';
import type { CanonicalInstrument } from './market-instrument-contracts.js';

const instrument: CanonicalInstrument = {
  instrumentId: 'metal:XAU:spot:LBMA',
  assetClass: 'XAU',
  instrumentType: 'SPOT_METAL',
  venue: 'LBMA',
  identifiers: ['XAU/USD'],
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  status: 'ACTIVE',
  provenanceHash: 'instrument-proof',
};

const definition: MetalInstrumentDefinition = {
  definitionId: 'xau-spot-lbma',
  instrumentId: instrument.instrumentId,
  metal: 'XAU',
  marketType: 'SPOT',
  venue: 'LBMA',
  quoteCurrency: 'USD',
  settlementCurrency: 'USD',
  unit: 'TROY_OUNCE',
  purity: 0.9995,
  minimumPriceIncrement: '0.01',
  evidenceRefs: ['metal-definition'],
  provenanceHash: 'definition-proof',
};

function quote(overrides: Partial<MetalQuote> = {}): MetalQuote {
  return {
    quoteId: 'q1',
    instrumentId: instrument.instrumentId,
    venue: 'LBMA',
    metal: 'XAU',
    unit: 'TROY_OUNCE',
    currency: 'USD',
    bidPrice: '2600.00',
    askPrice: '2602.00',
    observedAt: '2026-09-20T14:00:00Z',
    availableAt: '2026-09-20T14:00:01Z',
    receivedAt: '2026-09-20T14:00:02Z',
    provider: 'reference',
    evidenceRefs: ['quote-evidence'],
    provenanceHash: 'quote-proof',
    ...overrides,
  };
}

test('MONEY-METALS-01 creates a point-in-time non-executable spot snapshot', () => {
  const snapshot = buildMetalMarketSnapshot({
    instrument,
    definition,
    quotes: [
      quote(),
      quote({
        quoteId: 'future',
        bidPrice: '2700.00',
        askPrice: '2702.00',
        observedAt: '2026-09-20T16:00:00Z',
        availableAt: '2026-09-20T16:00:01Z',
        receivedAt: '2026-09-20T16:00:02Z',
      }),
    ],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'metals-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  });

  assert.equal(snapshot.quote.quoteId, 'q1');
  assert.equal(snapshot.midPrice, '2601.000');
  assert.ok(snapshot.spreadBps > 0);
  assert.equal(snapshot.researchAuthority, 'INTELLIGENCE_ONLY');
  assert.equal(snapshot.executionAuthority, 'NONE');
  assert.equal(snapshot.financialAuthority, 'NONE');
});

test('MONEY-METALS-01 fails closed on crossed quotes and invalid purity', () => {
  assert.throws(() => buildMetalMarketSnapshot({
    instrument,
    definition,
    quotes: [quote({ bidPrice: '2605', askPrice: '2600' })],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'metals-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  }), /MONEY_METALS_CROSSED_QUOTE/);

  assert.throws(() => assertMetalDefinition({ ...definition, purity: 1.1 }, instrument), /MONEY_METALS_PURITY_INVALID/);
});

test('MONEY-METALS-01 requires futures terms and rejects expired futures', () => {
  const futureInstrument: CanonicalInstrument = {
    ...instrument,
    instrumentId: 'metal:XAU:future:COMEX:202612',
    instrumentType: 'FUTURE',
    venue: 'COMEX',
    identifiers: ['GCZ26'],
  };
  const futureDefinition: MetalInstrumentDefinition = {
    ...definition,
    definitionId: 'xau-future-comex-202612',
    instrumentId: futureInstrument.instrumentId,
    marketType: 'FUTURE',
    venue: 'COMEX',
    contract: {
      expiry: '2026-09-19T00:00:00Z',
      contractSize: '100',
      settlement: 'PHYSICAL',
    },
  };

  assert.throws(() => buildMetalMarketSnapshot({
    instrument: futureInstrument,
    definition: futureDefinition,
    quotes: [quote({
      instrumentId: futureInstrument.instrumentId,
      venue: 'COMEX',
    })],
    informationCutoff: '2026-09-20T15:00:00Z',
    derivedAt: '2026-09-20T15:00:01Z',
    methodologyVersion: 'metals-reality-v1',
    sourceManifest: ['provider:reference'],
    snapshotHash: 'snapshot-proof',
  }), /MONEY_METALS_FUTURE_EXPIRED_AT_CUTOFF/);
});
