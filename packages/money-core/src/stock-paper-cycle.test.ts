import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaperAutopilotSettings,
} from './paper-autopilot-settings.js';
import {
  createPaperRealismProfile,
} from './paper-realism-profile.js';
import {
  planStockPaperCycle,
} from './stock-paper-cycle.js';
import type {
  AlpacaStockObservationBundle,
} from './alpaca-stock-market-data.js';
import type { StockBar, StockQuote } from './stock-market-reality.js';
import type {
  ProductionBrokerAccountSnapshot,
  ProductionBrokerPosition,
} from './production-broker-http-adapter.js';

function bars(closes: readonly number[]): StockBar[] {
  return closes.map((value, index) => {
    const startsAt = new Date(Date.UTC(2026, 0, index + 1)).toISOString();
    const endsAt = new Date(Date.UTC(2026, 0, index + 2)).toISOString();
    return {
      barId: 'bar:' + index,
      instrumentId: 'stock:TEST',
      venue: 'IEX',
      currency: 'USD',
      interval: '1D',
      startsAt,
      endsAt,
      observedAt: startsAt,
      availableAt: startsAt,
      receivedAt: endsAt,
      open: String(value),
      high: String(value + 1),
      low: String(Math.max(0.01, value - 1)),
      close: String(value),
      volume: '1000',
      adjustmentStatus: 'UNADJUSTED',
      provider: 'test',
      evidenceRef: 'e:bar:' + index,
      provenanceHash: 'p:bar:' + index,
    } as const;
  });
}

function quote(bid: string, ask: string): StockQuote {
  return {
    quoteId: 'q:test',
    instrumentId: 'stock:TEST',
    venue: 'IEX',
    currency: 'USD',
    bidPrice: bid,
    askPrice: ask,
    observedAt: '2026-03-01T20:00:00Z',
    availableAt: '2026-03-01T20:00:00Z',
    receivedAt: '2026-03-01T20:00:01Z',
    provider: 'test',
    evidenceRef: 'e:quote',
    provenanceHash: 'p:quote',
  };
}

function bundle(
  closes: readonly number[],
  q: StockQuote,
): AlpacaStockObservationBundle {
  const dailyBars = bars(closes);
  return {
    symbol: 'TEST',
    feed: 'iex',
    quote: q,
    dailyBars,
    observedAt: '2026-03-01T20:00:01Z',
    evidenceIds: Object.freeze([
      q.evidenceRef,
      ...dailyBars.map((bar) => bar.evidenceRef),
    ]),
    provenanceHash: 'bundle:test',
    authority: 'EVIDENCE_ONLY',
  };
}

const account: ProductionBrokerAccountSnapshot = {
  provider: 'alpaca',
  accountId: 'paper-acct',
  currency: 'USD',
  cashMinor: 1_000_000n,
  settledCashMinor: 1_000_000n,
  buyingPowerMinor: 1_000_000n,
  asOf: '2026-03-01T20:00:01Z',
  evidenceIds: Object.freeze(['e:account']),
};

const settings = createPaperAutopilotSettings({
  userId: 'u1',
  accountId: 'paper-acct',
  mode: 'PAPER_AUTO_REDUCED',
  stockFeed: 'iex',
  strategyId: 'stock-baseline-sma-20-50',
  baseOrderNotionalMinor: '100000',
  maxOrderNotionalMinor: '200000',
  maximumConcurrentPositions: 5,
  updatedAt: '2026-03-01T20:00:01Z',
  evidenceIds: ['user:settings'],
});

const realism = createPaperRealismProfile({
  profileId: 'stock-paper-v1',
  startingEquityMinor: 1_000_000n,
  currency: 'USD',
  leverageBps: 10_000,
  marginEnabled: false,
  slippageBps: 5,
  maximumRiskPerTradeBps: 100,
  requireProtectiveExitPlan: true,
});

test('reduced paper mode can gather first samples under explicit MIMS review with risk-sized bracket exits', () => {
  const closes = [
    ...Array.from({ length: 31 }, () => 100),
    ...Array.from({ length: 19 }, () => 99),
    120,
  ];
  const plan = planStockPaperCycle({
    userId: 'u1',
    paperRunId: 'run:1',
    settings,
    realismProfile: realism,
    bundle: bundle(closes, quote('119.9', '120')),
    account,
    positions: [],
    mimsStatus: 'REVIEW',
    providerHealth: 'HEALTHY',
    now: '2026-03-01T20:00:02Z',
  });

  assert.equal(plan.baseline.signal, 'LONG_ENTRY');
  assert.equal(plan.autopilot.disposition, 'PAPER_TRADE_ELIGIBLE');
  assert.equal(plan.autopilot.notionalMultiplierBps, 2500);
  assert.equal(plan.decision.action, 'PAPER_TRADE');
  assert.equal(plan.orderRequest?.side, 'BUY');
  assert.ok(BigInt(plan.orderRequest!.stopLossPriceMinor!) < 12_000n);
  assert.ok(BigInt(plan.orderRequest!.takeProfitPriceMinor!) > 12_000n);
  assert.equal(plan.realism?.status, 'PASS');
  assert.equal(plan.canAuthorizeLive, false);
});

test('full paper auto refuses an uncalibrated new entry', () => {
  const closes = [
    ...Array.from({ length: 31 }, () => 100),
    ...Array.from({ length: 19 }, () => 99),
    120,
  ];
  const plan = planStockPaperCycle({
    userId: 'u1',
    paperRunId: 'run:2',
    settings: createPaperAutopilotSettings({
      ...settings,
      mode: 'PAPER_AUTO',
      updatedAt: '2026-03-01T20:00:02Z',
    }),
    realismProfile: realism,
    bundle: bundle(closes, quote('119.9', '120')),
    account,
    positions: [],
    mimsStatus: 'PASS',
    providerHealth: 'HEALTHY',
    now: '2026-03-01T20:00:03Z',
  });

  assert.equal(plan.decision.action, 'NO_TRADE');
  assert.equal(plan.orderRequest, undefined);
  assert.ok(
    plan.autopilot.reasonCodes.includes(
      'PAPER_AUTO_REQUIRES_SUPPORTED_CALIBRATION',
    ),
  );
});

test('paper exit is allowed to reduce an existing long even before calibration support', () => {
  const closes = [
    ...Array.from({ length: 31 }, () => 100),
    ...Array.from({ length: 19 }, () => 101),
    80,
  ];
  const positions: ProductionBrokerPosition[] = [
    {
      provider: 'alpaca',
      accountId: 'paper-acct',
      instrumentId: 'stock:TEST',
      quantity: '10',
      marketValueMinor: 80_000n,
      currency: 'USD',
      asOf: '2026-03-01T20:00:01Z',
      evidenceIds: Object.freeze(['e:position']),
    },
  ];

  const plan = planStockPaperCycle({
    userId: 'u1',
    paperRunId: 'run:3',
    settings,
    realismProfile: realism,
    bundle: bundle(closes, quote('79.9', '80.1')),
    account,
    positions,
    mimsStatus: 'PASS',
    providerHealth: 'HEALTHY',
    now: '2026-03-01T20:00:02Z',
  });

  assert.equal(plan.baseline.signal, 'EXIT');
  assert.equal(plan.autopilot.disposition, 'PAPER_TRADE_ELIGIBLE');
  assert.ok(plan.autopilot.reasonCodes.includes('RISK_REDUCING_EXIT'));
  assert.equal(plan.orderRequest?.side, 'SELL');
  assert.equal(plan.orderRequest?.takeProfitPriceMinor, undefined);
  assert.equal(plan.orderRequest?.stopLossPriceMinor, undefined);
});
