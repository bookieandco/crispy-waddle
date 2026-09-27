import type { AlpacaPaperOrderRequest } from './alpaca-trading-adapter.js';
import type { AlpacaStockObservationBundle } from './alpaca-stock-market-data.js';
import type { PaperAutopilotSettings } from './paper-autopilot-settings.js';
import {
  createPaperDecision,
  evaluatePaperAutopilot,
  type PaperAutopilotEvaluation,
  type PaperDecisionObservation,
} from './paper-learning-loop.js';
import {
  assessPaperRealism,
  type PaperRealismAssessment,
  type PaperRealismProfile,
} from './paper-realism-profile.js';
import {
  evaluateStockSmaBaseline,
  type StockBaselineDecision,
} from './stock-paper-baseline-strategy.js';
import type { StrategyCalibration } from './autonomous-strategy-learning.js';
import type {
  ProductionBrokerAccountSnapshot,
  ProductionBrokerPosition,
} from './production-broker-http-adapter.js';

export const STOCK_PAPER_CYCLE_SCHEMA_VERSION =
  'MONEY-STOCK-PAPER-CYCLE-01' as const;

export type StockPaperCyclePlan = Readonly<{
  schemaVersion: typeof STOCK_PAPER_CYCLE_SCHEMA_VERSION;
  paperRunId: string;
  baseline: StockBaselineDecision;
  decision: PaperDecisionObservation;
  autopilot: PaperAutopilotEvaluation;
  realism?: PaperRealismAssessment;
  orderRequest?: AlpacaPaperOrderRequest;
  plannedMaximumLossMinor?: bigint;
  hardRiskStatus: 'PASS' | 'FAIL';
  hardRiskReasonCodes: readonly string[];
  authority: 'PAPER_PLAN_ONLY';
  canAuthorizeLive: false;
}>;

function positivePriceMinor(value: string, code: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error(code);
  const [whole, fraction = ''] = value.split('.');
  const result =
    BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if (result <= 0n) throw new Error(code);
  return result;
}

function priceMinorFromNumber(value: number, code: string): bigint {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
  return BigInt(Math.round(value * 100));
}

function minBigInt(...values: bigint[]): bigint {
  if (!values.length) throw new Error('MONEY_STOCK_PAPER_MIN_EMPTY');
  return values.reduce((best, value) => (value < best ? value : best));
}

function positionFor(
  positions: readonly ProductionBrokerPosition[],
  instrumentId: string,
): ProductionBrokerPosition | undefined {
  return positions.find(
    (position) =>
      position.instrumentId === instrumentId &&
      Number(position.quantity) > 0 &&
      position.marketValueMinor > 0n,
  );
}

function quantityNotionalMinor(quantity: string, priceMinor: bigint): bigint {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(quantity)) {
    throw new Error('MONEY_STOCK_PAPER_POSITION_QTY_INVALID');
  }
  const [whole, fraction = ''] = quantity.split('.');
  const scale = 1_000_000n;
  const qtyMicros =
    BigInt(whole) * scale + BigInt((fraction + '000000').slice(0, 6));
  if (qtyMicros <= 0n) {
    throw new Error('MONEY_STOCK_PAPER_POSITION_QTY_INVALID');
  }
  return (qtyMicros * priceMinor) / scale;
}

function averageTrueRange(
  bundle: AlpacaStockObservationBundle,
  period = 14,
): number {
  const bars = bundle.dailyBars.slice(-(period + 1));
  if (bars.length < period + 1) {
    throw new Error('MONEY_STOCK_PAPER_ATR_HISTORY_INSUFFICIENT');
  }
  const ranges: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const current = bars[i]!;
    const previous = bars[i - 1]!;
    const high = Number(current.high);
    const low = Number(current.low);
    const previousClose = Number(previous.close);
    if (
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(previousClose) ||
      high <= 0 ||
      low <= 0 ||
      previousClose <= 0 ||
      high < low
    ) {
      throw new Error('MONEY_STOCK_PAPER_ATR_BAR_INVALID');
    }
    ranges.push(
      Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose),
      ),
    );
  }
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function entryHardRisk(input: Readonly<{
  settings: PaperAutopilotSettings;
  account: ProductionBrokerAccountSnapshot;
  positions: readonly ProductionBrokerPosition[];
  instrumentId: string;
}>): { status: 'PASS' | 'FAIL'; reasons: readonly string[] } {
  const reasons: string[] = [];
  if (positionFor(input.positions, input.instrumentId)) {
    reasons.push('ALREADY_LONG');
  }
  const openLongs = input.positions.filter(
    (position) =>
      Number(position.quantity) > 0 && position.marketValueMinor > 0n,
  ).length;
  if (openLongs >= input.settings.maximumConcurrentPositions) {
    reasons.push('MAX_CONCURRENT_POSITIONS');
  }
  if (input.account.cashMinor <= 0n || input.account.settledCashMinor <= 0n) {
    reasons.push('NO_SETTLED_CASH');
  }
  return Object.freeze({
    status: reasons.length ? 'FAIL' : 'PASS',
    reasons: Object.freeze(reasons),
  });
}

function noTradeAutopilot(
  source: PaperAutopilotEvaluation,
  reasonCode: string,
): PaperAutopilotEvaluation {
  return Object.freeze({
    mode: source.mode,
    disposition: 'NO_TRADE',
    reasonCodes: Object.freeze([
      ...new Set([...source.reasonCodes, reasonCode]),
    ]),
    notionalMultiplierBps: 0,
    authority: 'PAPER_ONLY',
    canAuthorizeLive: false,
  });
}

export function planStockPaperCycle(input: Readonly<{
  userId: string;
  paperRunId: string;
  settings: PaperAutopilotSettings;
  realismProfile: PaperRealismProfile;
  bundle: AlpacaStockObservationBundle;
  account: ProductionBrokerAccountSnapshot;
  positions: readonly ProductionBrokerPosition[];
  calibration?: StrategyCalibration;
  mimsStatus: 'PASS' | 'REVIEW' | 'FAIL';
  providerHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  unresolvedExecutionCount?: number;
  now: string;
}>): StockPaperCyclePlan {
  if (input.settings.accountId !== input.account.accountId) {
    throw new Error('MONEY_STOCK_PAPER_ACCOUNT_BINDING_MISMATCH');
  }
  if (input.settings.userId !== input.userId) {
    throw new Error('MONEY_STOCK_PAPER_USER_BINDING_MISMATCH');
  }
  if (input.settings.strategyId !== 'stock-baseline-sma-20-50') {
    throw new Error('MONEY_STOCK_PAPER_STRATEGY_UNSUPPORTED');
  }
  if (input.bundle.dailyBars.length < 51) {
    throw new Error('MONEY_STOCK_PAPER_INSUFFICIENT_BARS');
  }
  if (input.realismProfile.currency !== input.account.currency) {
    throw new Error('MONEY_STOCK_PAPER_REALISM_CURRENCY_MISMATCH');
  }

  const baseline = evaluateStockSmaBaseline(input.bundle.dailyBars);
  const instrumentId = baseline.instrumentId;
  const existing = positionFor(input.positions, instrumentId);

  let hardRiskStatus: 'PASS' | 'FAIL' = 'PASS';
  let hardRiskReasonCodes: readonly string[] = Object.freeze([]);

  if (baseline.signal === 'LONG_ENTRY') {
    const risk = entryHardRisk({
      settings: input.settings,
      account: input.account,
      positions: input.positions,
      instrumentId,
    });
    hardRiskStatus = risk.status;
    hardRiskReasonCodes = risk.reasons;
  } else if (baseline.signal === 'EXIT' && !existing) {
    hardRiskStatus = 'FAIL';
    hardRiskReasonCodes = Object.freeze(['NO_LONG_POSITION_TO_EXIT']);
  }

  let autopilot = evaluatePaperAutopilot({
    mode: input.settings.mode,
    accountEnvironment: 'PAPER',
    signal: baseline.signal,
    mimsStatus: input.mimsStatus,
    mimsReviewExplorationAllowed:
      baseline.signal === 'LONG_ENTRY' &&
      input.settings.mode === 'PAPER_AUTO_REDUCED' &&
      input.calibration?.status !== 'SIMULATION_SUPPORTED',
    hardRiskStatus,
    behavioralRiskStatus: 'PASS',
    providerHealth: input.providerHealth,
    unresolvedExecutionCount: input.unresolvedExecutionCount ?? 0,
    calibration: input.calibration,
  });

  let orderRequest: AlpacaPaperOrderRequest | undefined;
  let realism: PaperRealismAssessment | undefined;
  let plannedMaximumLossMinor: bigint | undefined;

  if (autopilot.disposition === 'PAPER_TRADE_ELIGIBLE') {
    if (!input.bundle.quote) {
      autopilot = noTradeAutopilot(autopilot, 'CURRENT_QUOTE_REQUIRED');
    } else if (baseline.signal === 'LONG_ENTRY') {
      const askMinor = positivePriceMinor(
        input.bundle.quote.askPrice,
        'MONEY_STOCK_PAPER_ASK_INVALID',
      );
      const ask = Number(input.bundle.quote.askPrice);
      const atr = averageTrueRange(input.bundle);
      const stopDistance = Math.max(atr, ask * 0.01);
      const stopMinor = priceMinorFromNumber(
        Math.max(0.01, ask - stopDistance),
        'MONEY_STOCK_PAPER_STOP_INVALID',
      );
      const takeProfitMinor = priceMinorFromNumber(
        ask + stopDistance * 2,
        'MONEY_STOCK_PAPER_TAKE_PROFIT_INVALID',
      );
      const distanceMinor = askMinor - stopMinor;
      const riskBudgetMinor =
        (input.account.cashMinor *
          BigInt(input.realismProfile.maximumRiskPerTradeBps)) /
        10_000n;
      const riskSizedNotional =
        distanceMinor > 0n
          ? (riskBudgetMinor * askMinor) / distanceMinor
          : 0n;
      const modeScaledBase =
        (BigInt(input.settings.baseOrderNotionalMinor) *
          BigInt(autopilot.notionalMultiplierBps)) /
        10_000n;
      const requestedNotional = minBigInt(
        modeScaledBase,
        BigInt(input.settings.maxOrderNotionalMinor),
        input.account.cashMinor,
        input.account.settledCashMinor,
        riskSizedNotional,
      );

      if (requestedNotional <= 0n) {
        autopilot = noTradeAutopilot(autopilot, 'RISK_SIZED_NOTIONAL_ZERO');
      } else {
        plannedMaximumLossMinor =
          (requestedNotional * distanceMinor) / askMinor;
        realism = assessPaperRealism({
          profile: input.realismProfile,
          currentEquityMinor:
            input.account.cashMinor +
            input.positions.reduce(
              (sum, position) => sum + position.marketValueMinor,
              0n,
            ),
          requestedNotionalMinor: requestedNotional,
          plannedMaximumLossMinor,
          hasProtectiveExitPlan: true,
        });

        if (realism.status !== 'PASS') {
          autopilot = noTradeAutopilot(
            autopilot,
            'PAPER_REALISM_' + realism.status,
          );
        } else {
          orderRequest = Object.freeze({
            clientOrderId: baseline.decisionId + ':' + input.account.accountId,
            accountId: input.account.accountId,
            instrumentId,
            side: 'BUY',
            orderType: 'LIMIT',
            notionalMinor: requestedNotional.toString(),
            limitPriceMinor: askMinor.toString(),
            currency: input.account.currency,
            timeInForce: 'DAY',
            stopLossPriceMinor: stopMinor.toString(),
            takeProfitPriceMinor: takeProfitMinor.toString(),
          });
        }
      }
    } else if (baseline.signal === 'EXIT' && existing) {
      const bidMinor = positivePriceMinor(
        input.bundle.quote.bidPrice,
        'MONEY_STOCK_PAPER_BID_INVALID',
      );
      const closeNotional = quantityNotionalMinor(
        existing.quantity,
        bidMinor,
      );
      if (closeNotional <= 0n) {
        autopilot = noTradeAutopilot(
          autopilot,
          'EXIT_NOTIONAL_ZERO',
        );
      } else {
        orderRequest = Object.freeze({
          clientOrderId: baseline.decisionId + ':' + input.account.accountId,
          accountId: input.account.accountId,
          instrumentId,
          side: 'SELL',
          orderType: 'LIMIT',
          notionalMinor: closeNotional.toString(),
          limitPriceMinor: bidMinor.toString(),
          currency: input.account.currency,
          timeInForce: 'DAY',
        });
      }
    }
  }

  const willTrade =
    autopilot.disposition === 'PAPER_TRADE_ELIGIBLE' &&
    orderRequest !== undefined;
  const reasonCodes = Object.freeze([
    'BASELINE_' + baseline.signal,
    ...hardRiskReasonCodes,
    ...autopilot.reasonCodes,
    ...(realism ? ['PAPER_REALISM_' + realism.status] : []),
  ]);

  const decision = createPaperDecision({
    decisionId: baseline.decisionId + ':' + input.account.accountId,
    paperRunId: input.paperRunId,
    accountId: input.account.accountId,
    instrumentId,
    strategyId: baseline.strategyId,
    scenarioId: 'stock-daily-baseline:' + input.bundle.symbol,
    action: willTrade ? 'PAPER_TRADE' : 'NO_TRADE',
    side: willTrade ? orderRequest!.side : undefined,
    signal: baseline.signal,
    reasonCodes,
    informationCutoff: baseline.informationCutoff,
    createdAt: input.now,
    evidenceIds: Object.freeze([
      ...new Set([
        ...baseline.evidenceIds,
        ...input.bundle.evidenceIds,
        ...input.account.evidenceIds,
        ...input.positions.flatMap((position) => position.evidenceIds),
      ]),
    ]),
  });

  return Object.freeze({
    schemaVersion: STOCK_PAPER_CYCLE_SCHEMA_VERSION,
    paperRunId: input.paperRunId,
    baseline,
    decision,
    autopilot,
    realism,
    orderRequest,
    plannedMaximumLossMinor,
    hardRiskStatus,
    hardRiskReasonCodes,
    authority: 'PAPER_PLAN_ONLY',
    canAuthorizeLive: false,
  });
}
