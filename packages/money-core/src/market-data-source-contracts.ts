export const MARKET_DATA_SOURCE_SCHEMA_VERSION = 'MONEY-DATA-SOURCE-01' as const;

export type MarketDataSourceKind =
  | 'OFFICIAL_GOVERNMENT'
  | 'OFFICIAL_EXCHANGE'
  | 'LICENSED_API'
  | 'PUBLIC_WEB'
  | 'REFERENCE_CODE'
  | 'OTHER';

export type MarketDataTransport =
  | 'HTTP'
  | 'WEBSOCKET'
  | 'FILE_EXPORT'
  | 'LOCAL_COMPUTE'
  | 'OTHER';

export type MarketDataCapability =
  | 'LIVE_TICKS'
  | 'HISTORICAL_TICKS'
  | 'CANDLES'
  | 'OPTIONS_CHAIN'
  | 'OPTIONS_PRINTS'
  | 'OPTIONS_GREEKS'
  | 'FILINGS'
  | 'XBRL'
  | 'SHORT_VOLUME'
  | 'COT'
  | 'YIELD_CURVE'
  | 'ECONOMIC_CALENDAR'
  | 'MACRO_SERIES'
  | 'INSIDER_TRADES'
  | 'DIVIDENDS'
  | 'SPLITS'
  | 'FUNDAMENTALS'
  | 'FUTURES'
  | 'FOREX'
  | 'CRYPTO'
  | 'BONDS'
  | 'OTHER';

export type MarketDataUsePurpose =
  | 'RESEARCH'
  | 'MODEL_TRAINING'
  | 'COMMERCIAL_INTERNAL'
  | 'REDISTRIBUTION'
  | 'RESALE';

export type MarketDataPermission =
  | 'ALLOWED'
  | 'RESTRICTED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type MarketDataRightsBasis =
  | 'PROVIDER_DECLARED'
  | 'UPSTREAM_TERMS_REVIEW'
  | 'UNKNOWN';

export type PointInTimeSupport =
  | 'NATIVE_AVAILABLE_AT'
  | 'DERIVABLE'
  | 'NONE'
  | 'UNKNOWN';

export type MarketDataRightsProfile = Readonly<{
  basis: MarketDataRightsBasis;
  termsLocator?: string;
  evaluatedAt: string;
  research: MarketDataPermission;
  modelTraining: MarketDataPermission;
  commercialInternal: MarketDataPermission;
  redistribution: MarketDataPermission;
  resale: MarketDataPermission;
  notes?: string;
  evidenceRefs: readonly string[];
}>;

export type MarketDataSourceContract = Readonly<{
  schemaVersion: typeof MARKET_DATA_SOURCE_SCHEMA_VERSION;
  sourceId: string;
  providerName: string;
  sourceKind: MarketDataSourceKind;
  canonicalLocator: string;
  codeLicenseExpression?: string;
  transports: readonly MarketDataTransport[];
  capabilities: readonly MarketDataCapability[];
  assetClasses: readonly string[];
  pointInTimeSupport: PointInTimeSupport;
  supportsObservedAt: boolean;
  supportsAvailableAt: boolean;
  rights: MarketDataRightsProfile;
  provenanceHash: string;
  financialAuthority: 'NONE';
}>;

function assertNonEmpty(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

function assertTimestamp(value: string, code: string): void {
  if (Number.isNaN(Date.parse(value))) throw new Error(code);
}

function permissionForPurpose(
  rights: MarketDataRightsProfile,
  purpose: MarketDataUsePurpose,
): MarketDataPermission {
  switch (purpose) {
    case 'RESEARCH':
      return rights.research;
    case 'MODEL_TRAINING':
      return rights.modelTraining;
    case 'COMMERCIAL_INTERNAL':
      return rights.commercialInternal;
    case 'REDISTRIBUTION':
      return rights.redistribution;
    case 'RESALE':
      return rights.resale;
  }
}

export function assertMarketDataSourceContract(
  source: MarketDataSourceContract,
): void {
  if (source.schemaVersion !== MARKET_DATA_SOURCE_SCHEMA_VERSION) {
    throw new Error('MONEY_DATA_SOURCE_SCHEMA_INVALID');
  }
  assertNonEmpty(source.sourceId, 'MONEY_DATA_SOURCE_ID_REQUIRED');
  assertNonEmpty(source.providerName, 'MONEY_DATA_SOURCE_PROVIDER_REQUIRED');
  assertNonEmpty(source.canonicalLocator, 'MONEY_DATA_SOURCE_LOCATOR_REQUIRED');
  assertNonEmpty(source.provenanceHash, 'MONEY_DATA_SOURCE_PROVENANCE_REQUIRED');
  if (!/^https:\/\//.test(source.canonicalLocator)) {
    throw new Error('MONEY_DATA_SOURCE_LOCATOR_INVALID');
  }
  if (source.transports.length === 0 && source.sourceKind !== 'REFERENCE_CODE') {
    throw new Error('MONEY_DATA_SOURCE_TRANSPORT_REQUIRED');
  }
  if (source.capabilities.length === 0 && source.sourceKind !== 'REFERENCE_CODE') {
    throw new Error('MONEY_DATA_SOURCE_CAPABILITY_REQUIRED');
  }
  if (source.rights.evidenceRefs.length === 0) {
    throw new Error('MONEY_DATA_SOURCE_RIGHTS_EVIDENCE_REQUIRED');
  }
  assertTimestamp(source.rights.evaluatedAt, 'MONEY_DATA_SOURCE_RIGHTS_DATE_INVALID');
  if (
    source.rights.basis !== 'UNKNOWN' &&
    !source.rights.termsLocator
  ) {
    throw new Error('MONEY_DATA_SOURCE_TERMS_LOCATOR_REQUIRED');
  }
  if (source.financialAuthority !== 'NONE') {
    throw new Error('MONEY_DATA_SOURCE_FINANCIAL_AUTHORITY_FORBIDDEN');
  }
}

export function assertMarketDataUseAllowed(
  source: MarketDataSourceContract,
  purpose: MarketDataUsePurpose,
): void {
  assertMarketDataSourceContract(source);
  const permission = permissionForPurpose(source.rights, purpose);
  if (permission !== 'ALLOWED') {
    throw new Error(
      `MONEY_DATA_SOURCE_USE_NOT_ALLOWED:${source.sourceId}:${purpose}:${permission}`,
    );
  }
}

export function canSupportPointInTimeResearch(
  source: MarketDataSourceContract,
): boolean {
  assertMarketDataSourceContract(source);
  return (
    source.sourceKind !== 'REFERENCE_CODE' &&
    source.rights.research === 'ALLOWED' &&
    source.pointInTimeSupport !== 'NONE' &&
    source.pointInTimeSupport !== 'UNKNOWN' &&
    source.supportsObservedAt &&
    source.provenanceHash.length > 0
  );
}

export function marketDataSourceRiskFlags(
  source: MarketDataSourceContract,
): readonly string[] {
  assertMarketDataSourceContract(source);
  const flags: string[] = [];
  if (source.sourceKind === 'REFERENCE_CODE') flags.push('REFERENCE_CODE_NOT_RUNTIME_DATA');
  if (source.pointInTimeSupport === 'UNKNOWN') flags.push('POINT_IN_TIME_UNKNOWN');
  if (!source.supportsAvailableAt) flags.push('AVAILABLE_AT_NOT_NATIVE');
  if (source.rights.basis === 'UNKNOWN') flags.push('DATA_RIGHTS_UNKNOWN');
  if (source.rights.commercialInternal !== 'ALLOWED') flags.push('COMMERCIAL_USE_NOT_CLEARED');
  if (source.rights.redistribution !== 'ALLOWED') flags.push('REDISTRIBUTION_NOT_CLEARED');
  return Object.freeze(flags);
}
