export const TRADING_VEHICLE_SEMANTICS_VERSION =
  'MONEY-VEHICLE-SEMANTICS-01' as const;

export type VehicleSemantics = Readonly<{
  schemaVersion: typeof TRADING_VEHICLE_SEMANTICS_VERSION;
  vehicle: 'OPTION' | 'FUTURE';
  contractsExpire: true;
  marketHoursAreVenueAndProductSpecific: true;
  chartReadingConceptsMayTransfer: true;
  strategyEdgeTransfersWithoutValidation: false;
  financialAuthority: 'NONE';
}>;

export type OptionFoundationSemantics = VehicleSemantics &
  Readonly<{
    vehicle: 'OPTION';
    longCallCanExpressBullishView: true;
    longPutCanExpressBearishView: true;
    optionRightAloneDeterminesStrategyDirection: false;
    buyerHasRightNotObligation: true;
    sellerMayHaveAssignmentObligation: true;
    longOptionCanExpireWorthless: true;
    premiumIsPartOfEconomicRisk: true;
  }>;

export type FutureFoundationSemantics = VehicleSemantics &
  Readonly<{
    vehicle: 'FUTURE';
    contractIsStandardized: true;
    automaticRollover: false;
    continuousChartMaySpanMultipleContracts: true;
    contractSelectionAndRollPolicyRequired: true;
  }>;

export function optionFoundationSemantics(): OptionFoundationSemantics {
  return Object.freeze({
    schemaVersion: TRADING_VEHICLE_SEMANTICS_VERSION,
    vehicle: 'OPTION',
    contractsExpire: true,
    marketHoursAreVenueAndProductSpecific: true,
    chartReadingConceptsMayTransfer: true,
    strategyEdgeTransfersWithoutValidation: false,
    longCallCanExpressBullishView: true,
    longPutCanExpressBearishView: true,
    optionRightAloneDeterminesStrategyDirection: false,
    buyerHasRightNotObligation: true,
    sellerMayHaveAssignmentObligation: true,
    longOptionCanExpireWorthless: true,
    premiumIsPartOfEconomicRisk: true,
    financialAuthority: 'NONE',
  });
}

export function futureFoundationSemantics(): FutureFoundationSemantics {
  return Object.freeze({
    schemaVersion: TRADING_VEHICLE_SEMANTICS_VERSION,
    vehicle: 'FUTURE',
    contractsExpire: true,
    marketHoursAreVenueAndProductSpecific: true,
    chartReadingConceptsMayTransfer: true,
    strategyEdgeTransfersWithoutValidation: false,
    contractIsStandardized: true,
    automaticRollover: false,
    continuousChartMaySpanMultipleContracts: true,
    contractSelectionAndRollPolicyRequired: true,
    financialAuthority: 'NONE',
  });
}
