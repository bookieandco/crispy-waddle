export const OPTIONS_SCHEMA_VERSION = 'MONEY-OPTIONS-01' as const;

export type OptionRight = 'CALL' | 'PUT';
export type OptionPositionSide = 'LONG' | 'SHORT';
export type OptionExerciseStyle = 'AMERICAN' | 'EUROPEAN' | 'OTHER';
export type OptionSettlementType = 'PHYSICAL' | 'CASH' | 'OTHER';

export type OptionContract = Readonly<{
  schemaVersion: typeof OPTIONS_SCHEMA_VERSION;
  optionId: string;
  underlyingInstrumentId: string;
  right: OptionRight;
  positionSide: OptionPositionSide;
  strikePrice: number;
  premiumPerUnit: number;
  quantity: number;
  contractMultiplier: number;
  expirationAt: string;
  quoteCurrency: string;
  exerciseStyle: OptionExerciseStyle;
  settlementType: OptionSettlementType;
  evidenceRefs: readonly string[];
  methodologyVersion: string;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type OptionPremiumSnapshot = Readonly<{
  optionId: string;
  underlyingPrice: number;
  observedPremiumPerUnit: number;
  intrinsicValuePerUnit: number;
  extrinsicValuePerUnit: number;
  impliedVolatility?: number;
  timeToExpirationYears: number;
  observedAt: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

export type OptionBound = Readonly<{
  kind: 'DEFINED' | 'UNBOUNDED';
  amount?: number;
}>;

export type OptionRiskProfile = Readonly<{
  optionId: string;
  premiumCashFlow: number;
  breakEvenUnderlyingPrice: number;
  maxLoss: OptionBound;
  maxGain: OptionBound;
  assignmentObligation: boolean;
  canExpireWorthless: boolean;
  authority: 'ANALYSIS_ONLY';
}>;

function assertFiniteNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(code);
}

function assertFinitePositive(value: number, code: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
}

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

export function assertOptionContract(contract: OptionContract): void {
  if (contract.schemaVersion !== OPTIONS_SCHEMA_VERSION) {
    throw new Error('MONEY_OPTIONS_SCHEMA_VERSION_INVALID');
  }
  assertNonEmpty(contract.optionId, 'MONEY_OPTIONS_ID_REQUIRED');
  assertNonEmpty(contract.underlyingInstrumentId, 'MONEY_OPTIONS_UNDERLYING_REQUIRED');
  assertFinitePositive(contract.strikePrice, 'MONEY_OPTIONS_STRIKE_INVALID');
  assertFiniteNonNegative(contract.premiumPerUnit, 'MONEY_OPTIONS_PREMIUM_INVALID');
  assertFinitePositive(contract.quantity, 'MONEY_OPTIONS_QUANTITY_INVALID');
  assertFinitePositive(contract.contractMultiplier, 'MONEY_OPTIONS_MULTIPLIER_INVALID');
  assertNonEmpty(contract.quoteCurrency, 'MONEY_OPTIONS_CURRENCY_REQUIRED');
  assertNonEmpty(contract.methodologyVersion, 'MONEY_OPTIONS_METHODOLOGY_REQUIRED');
  assertNonEmpty(contract.provenanceHash, 'MONEY_OPTIONS_PROVENANCE_REQUIRED');
  if (contract.evidenceRefs.length === 0) {
    throw new Error('MONEY_OPTIONS_EVIDENCE_REQUIRED');
  }
  if (contract.financialAuthority !== 'NONE') {
    throw new Error('MONEY_OPTIONS_FINANCIAL_AUTHORITY_FORBIDDEN');
  }
  const expiry = Date.parse(contract.expirationAt);
  if (Number.isNaN(expiry)) throw new Error('MONEY_OPTIONS_EXPIRY_INVALID');
}

export function intrinsicValuePerUnit(
  right: OptionRight,
  underlyingPrice: number,
  strikePrice: number,
): number {
  assertFiniteNonNegative(underlyingPrice, 'MONEY_OPTIONS_UNDERLYING_PRICE_INVALID');
  assertFinitePositive(strikePrice, 'MONEY_OPTIONS_STRIKE_INVALID');
  return right === 'CALL'
    ? Math.max(0, underlyingPrice - strikePrice)
    : Math.max(0, strikePrice - underlyingPrice);
}

export function expiryPnlPerUnit(contract: OptionContract, underlyingPriceAtExpiry: number): number {
  assertOptionContract(contract);
  const intrinsic = intrinsicValuePerUnit(contract.right, underlyingPriceAtExpiry, contract.strikePrice);
  const longPnl = intrinsic - contract.premiumPerUnit;
  return contract.positionSide === 'LONG' ? longPnl : -longPnl;
}

export function expiryPnl(contract: OptionContract, underlyingPriceAtExpiry: number): number {
  return expiryPnlPerUnit(contract, underlyingPriceAtExpiry) *
    contract.contractMultiplier *
    contract.quantity;
}

export function optionBreakEvenUnderlyingPrice(contract: OptionContract): number {
  assertOptionContract(contract);
  return contract.right === 'CALL'
    ? contract.strikePrice + contract.premiumPerUnit
    : Math.max(0, contract.strikePrice - contract.premiumPerUnit);
}

export function deriveOptionPremiumSnapshot(input: Readonly<{
  contract: OptionContract;
  underlyingPrice: number;
  observedPremiumPerUnit: number;
  impliedVolatility?: number;
  timeToExpirationYears: number;
  observedAt: string;
  evidenceRefs: readonly string[];
  provenanceHash: string;
}>): OptionPremiumSnapshot {
  assertOptionContract(input.contract);
  assertFiniteNonNegative(input.underlyingPrice, 'MONEY_OPTIONS_UNDERLYING_PRICE_INVALID');
  assertFiniteNonNegative(input.observedPremiumPerUnit, 'MONEY_OPTIONS_OBSERVED_PREMIUM_INVALID');
  assertFiniteNonNegative(input.timeToExpirationYears, 'MONEY_OPTIONS_TIME_VALUE_INVALID');
  if (input.impliedVolatility !== undefined) {
    assertFiniteNonNegative(input.impliedVolatility, 'MONEY_OPTIONS_IV_INVALID');
  }
  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('MONEY_OPTIONS_OBSERVED_AT_INVALID');
  }
  if (input.evidenceRefs.length === 0 || !input.provenanceHash) {
    throw new Error('MONEY_OPTIONS_PREMIUM_EVIDENCE_REQUIRED');
  }

  const intrinsic = intrinsicValuePerUnit(
    input.contract.right,
    input.underlyingPrice,
    input.contract.strikePrice,
  );

  return Object.freeze({
    optionId: input.contract.optionId,
    underlyingPrice: input.underlyingPrice,
    observedPremiumPerUnit: input.observedPremiumPerUnit,
    intrinsicValuePerUnit: intrinsic,
    extrinsicValuePerUnit: Math.max(0, input.observedPremiumPerUnit - intrinsic),
    impliedVolatility: input.impliedVolatility,
    timeToExpirationYears: input.timeToExpirationYears,
    observedAt: input.observedAt,
    evidenceRefs: Object.freeze([...input.evidenceRefs]),
    provenanceHash: input.provenanceHash,
    financialAuthority: 'NONE',
  });
}

export function buildOptionRiskProfile(contract: OptionContract): OptionRiskProfile {
  assertOptionContract(contract);
  const scale = contract.contractMultiplier * contract.quantity;
  const premium = contract.premiumPerUnit * scale;
  const breakEven = optionBreakEvenUnderlyingPrice(contract);

  let maxLoss: OptionBound;
  let maxGain: OptionBound;

  if (contract.positionSide === 'LONG' && contract.right === 'CALL') {
    maxLoss = Object.freeze({ kind: 'DEFINED', amount: premium });
    maxGain = Object.freeze({ kind: 'UNBOUNDED' });
  } else if (contract.positionSide === 'LONG' && contract.right === 'PUT') {
    maxLoss = Object.freeze({ kind: 'DEFINED', amount: premium });
    maxGain = Object.freeze({
      kind: 'DEFINED',
      amount: Math.max(0, contract.strikePrice - contract.premiumPerUnit) * scale,
    });
  } else if (contract.positionSide === 'SHORT' && contract.right === 'CALL') {
    maxLoss = Object.freeze({ kind: 'UNBOUNDED' });
    maxGain = Object.freeze({ kind: 'DEFINED', amount: premium });
  } else {
    maxLoss = Object.freeze({
      kind: 'DEFINED',
      amount: Math.max(0, contract.strikePrice - contract.premiumPerUnit) * scale,
    });
    maxGain = Object.freeze({ kind: 'DEFINED', amount: premium });
  }

  return Object.freeze({
    optionId: contract.optionId,
    premiumCashFlow: contract.positionSide === 'LONG' ? -premium : premium,
    breakEvenUnderlyingPrice: breakEven,
    maxLoss,
    maxGain,
    assignmentObligation: contract.positionSide === 'SHORT',
    canExpireWorthless: true,
    authority: 'ANALYSIS_ONLY',
  });
}
