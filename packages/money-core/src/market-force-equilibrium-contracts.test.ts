import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MARKET_FORCE_SCHEMA_VERSION,
  applyMarketForceScenario,
  assertMarketForceDiagnosticNonExecutable,
  computeMarketForceDiagnostic,
  type MarketForceModel,
  type MarketForceSnapshot,
} from './market-force-equilibrium-contracts.js';

const model: MarketForceModel = {
  modelId: 'research-force-model',
  modelVersion: '1',
  weights: {
    DEMAND: 0.35,
    SUPPLY: 0.20,
    VOLATILITY: 0.20,
    LIQUIDITY: 0.15,
    SPECULATION: 0.30,
  },
  maxAbsShiftPct: 0.15,
  baseBandPct: 0.05,
  dispersionBandScale: 0.05,
  volatilityBandScale: 0.08,
  maxBandPct: 0.25,
  tensionVolatilityScale: 0.5,
  calibrationStatus: 'UNVALIDATED',
  methodologyNotes: [
    'Interpretive research model only; signed forces already encode directional pressure.',
  ],
};

function snapshot(
  overrides: Partial<MarketForceSnapshot> = {},
): MarketForceSnapshot {
  return {
    schemaVersion: MARKET_FORCE_SCHEMA_VERSION,
    snapshotId: 'snapshot:btc:1',
    instrumentId: 'crypto:BTC',
    currentPrice: 100,
    forces: {
      DEMAND: 0.4,
      SUPPLY: 0.2,
      VOLATILITY: -0.6,
      LIQUIDITY: 0.3,
      SPECULATION: 0.5,
    },
    observedAt: '2026-09-26T20:00:00Z',
    availableAt: '2026-09-26T20:00:01Z',
    evidenceIds: ['market-snapshot:1'],
    provenanceHash: 'snapshot-proof',
    signConvention: 'POSITIVE_UPWARD_NEGATIVE_DOWNWARD',
    authority: 'EVIDENCE_ONLY',
    ...overrides,
  };
}

test('MONEY-MARKET-FORCE-01 keeps signed volatility direction without double-negation', () => {
  const onlyVolatility = snapshot({
    forces: {
      DEMAND: 0,
      SUPPLY: 0,
      VOLATILITY: -1,
      LIQUIDITY: 0,
      SPECULATION: 0,
    },
  });

  const diagnostic = computeMarketForceDiagnostic(onlyVolatility, model);

  assert.ok(diagnostic.contributions.VOLATILITY < 0);
  assert.ok(diagnostic.netForce < 0);
  assert.ok(diagnostic.equilibriumShiftPct < 0);
  assert.ok(diagnostic.heuristicCenterPrice < onlyVolatility.currentPrice);
});

test('MONEY-MARKET-FORCE-01 normalizes weights and remains interpretive only', () => {
  const diagnostic = computeMarketForceDiagnostic(snapshot(), model);

  const sum = Object.values(diagnostic.normalizedWeights).reduce(
    (total, value) => total + value,
    0,
  );

  assert.ok(Math.abs(sum - 1) < 1e-12);
  assert.equal(diagnostic.calibrationStatus, 'UNVALIDATED');
  assert.equal(diagnostic.interpretiveOnly, true);
  assert.equal(diagnostic.canAuthorizeTrade, false);
  assert.equal(diagnostic.authority, 'RESEARCH_ONLY');
  assert.doesNotThrow(() =>
    assertMarketForceDiagnosticNonExecutable(diagnostic),
  );
});

test('MONEY-MARKET-FORCE-01 widens diagnostic band with force disagreement and volatility', () => {
  const calm = computeMarketForceDiagnostic(
    snapshot({
      forces: {
        DEMAND: 0.1,
        SUPPLY: 0.1,
        VOLATILITY: -0.1,
        LIQUIDITY: 0.1,
        SPECULATION: 0.1,
      },
    }),
    model,
  );

  const stressed = computeMarketForceDiagnostic(
    snapshot({
      snapshotId: 'snapshot:btc:stressed',
      forces: {
        DEMAND: 1,
        SUPPLY: -1,
        VOLATILITY: -1,
        LIQUIDITY: -1,
        SPECULATION: 1,
      },
    }),
    model,
  );

  const calmWidth = calm.upperBandPrice - calm.lowerBandPrice;
  const stressedWidth = stressed.upperBandPrice - stressed.lowerBandPrice;

  assert.ok(stressed.forceDispersion > calm.forceDispersion);
  assert.ok(stressed.tensionScore > calm.tensionScore);
  assert.ok(stressedWidth > calmWidth);
});

test('MONEY-MARKET-FORCE-01 scenario shocks are bounded and remain evidence-only', () => {
  const baseline = snapshot();
  const shocked = applyMarketForceScenario(
    baseline,
    {
      scenarioId: 'liquidity-crunch',
      baselineSnapshotId: baseline.snapshotId,
      forceDeltas: {
        LIQUIDITY: -2,
        VOLATILITY: -1,
        DEMAND: -0.8,
      },
      notes: ['Hypothetical research shock'],
    },
    '2026-09-26T20:00:02Z',
    'scenario-proof',
  );

  assert.equal(shocked.forces.LIQUIDITY, -1);
  assert.equal(shocked.forces.VOLATILITY, -1);
  assert.ok(shocked.forces.DEMAND >= -1);
  assert.equal(shocked.authority, 'EVIDENCE_ONLY');
  assert.ok(shocked.evidenceIds.includes('scenario:liquidity-crunch'));
});

test('MONEY-MARKET-FORCE-01 rejects negative model weights and malformed evidence', () => {
  assert.throws(
    () =>
      computeMarketForceDiagnostic(snapshot(), {
        ...model,
        weights: {
          ...model.weights,
          VOLATILITY: -0.2,
        },
      }),
    /MONEY_MARKET_FORCE_NEGATIVE_WEIGHT_FORBIDDEN/,
  );

  assert.throws(
    () =>
      computeMarketForceDiagnostic(
        snapshot({ evidenceIds: [] }),
        model,
      ),
    /MONEY_MARKET_FORCE_PROVENANCE_REQUIRED/,
  );
});
