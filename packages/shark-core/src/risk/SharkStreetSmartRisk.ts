import type { SharkObservation } from '../observations/SharkObservation';

export type SharkRiskSeverity = 'info' | 'warning' | 'critical';

export interface SharkRiskFlag {
  readonly code: string;
  readonly severity: SharkRiskSeverity;
  readonly title: string;
  readonly rationale: string;
  readonly observationIds: readonly string[];
}

export interface SharkStreetSmartRisk {
  readonly riskScore: number;
  readonly rugRisk: number;
  readonly flags: readonly SharkRiskFlag[];
  readonly blocked: boolean;
}

const num = (observation: SharkObservation, key: string): number | undefined => {
  const value = observation.value[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

export function evaluateStreetSmartRisk(
  observations: readonly SharkObservation[],
): SharkStreetSmartRisk {
  const flags: SharkRiskFlag[] = [];
  const ids = (kind: SharkObservation['kind']) => observations.filter(o => o.kind === kind).map(o => o.id);

  const liquidity = observations.filter(o => o.kind === 'liquidity');
  const holders = observations.filter(o => o.kind === 'holder_distribution');
  const creator = observations.filter(o => o.kind === 'creator_behavior');
  const flows = observations.filter(o => o.kind === 'wallet_flow');
  const migration = observations.filter(o => o.kind === 'migration');

  const liquidityDrops = liquidity.some(o => {
    const change = num(o, 'changePct');
    return change !== undefined && change <= -30;
  });
  if (liquidityDrops) {
    flags.push({ code: 'LIQUIDITY_DRAIN', severity: 'critical', title: 'Liquidity is leaving fast', rationale: 'A large observed liquidity decline is consistent with an exit or rug pattern.', observationIds: ids('liquidity') });
  }

  const concentrated = holders.some(o => {
    const top10 = num(o, 'top10Pct');
    return top10 !== undefined && top10 >= 70;
  });
  if (concentrated) {
    flags.push({ code: 'HOLDER_CONCENTRATION', severity: 'warning', title: 'Ownership is concentrated', rationale: 'A small holder set controls an unusually large share of supply.', observationIds: ids('holder_distribution') });
  }

  const creatorRedFlag = creator.some(o => {
    const score = num(o, 'riskScore');
    return score !== undefined && score >= 0.7;
  });
  if (creatorRedFlag) {
    flags.push({ code: 'CREATOR_RISK', severity: 'critical', title: 'Creator behavior is high risk', rationale: 'Observed creator behavior matches a configured high-risk threshold.', observationIds: ids('creator_behavior') });
  }

  const abnormalFlow = flows.some(o => {
    const anomaly = num(o, 'anomalyScore');
    return anomaly !== undefined && anomaly >= 0.8;
  });
  if (abnormalFlow) {
    flags.push({ code: 'WALLET_FLOW_ANOMALY', severity: 'warning', title: 'Wallet flows look abnormal', rationale: 'Observed wallet activity is materially outside the expected pattern.', observationIds: ids('wallet_flow') });
  }

  const migrationRisk = migration.some(o => {
    const risk = num(o, 'riskScore');
    return risk !== undefined && risk >= 0.7;
  });
  if (migrationRisk) {
    flags.push({ code: 'MIGRATION_RISK', severity: 'warning', title: 'Migration behavior needs caution', rationale: 'Observed migration activity carries elevated configured risk.', observationIds: ids('migration') });
  }

  const critical = flags.filter(f => f.severity === 'critical').length;
  const warnings = flags.filter(f => f.severity === 'warning').length;
  const riskScore = Math.min(1, critical * 0.35 + warnings * 0.15);
  const rugRisk = Math.min(1, critical * 0.4 + warnings * 0.12);

  return {
    riskScore,
    rugRisk,
    flags,
    blocked: critical > 0,
  };
}
