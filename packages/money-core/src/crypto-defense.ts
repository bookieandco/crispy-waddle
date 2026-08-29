export type CryptoThreatLevel = 'clear' | 'watch' | 'elevated' | 'critical';

export type CryptoThreatSignalKind =
  | 'liquidity_removed'
  | 'sell_restricted'
  | 'transfer_tax_changed'
  | 'blacklist_changed'
  | 'owner_changed'
  | 'proxy_upgraded'
  | 'mint_authority_changed'
  | 'pause_authority_changed'
  | 'unverified_contract'
  | 'simulation_failure'
  | 'unexpected_admin_action';

export type CryptoThreatSignal = {
  kind: CryptoThreatSignalKind;
  severity: CryptoThreatLevel;
  detectedAt: string;
  chain: string;
  contractAddress: string;
  transactionHash?: string;
  evidence: Readonly<Record<string, string>>;
};

export type CryptoDefenseDecision =
  | { action: 'monitor'; reason: string }
  | { action: 'block_new_exposure'; reason: string }
  | { action: 'request_exit'; reason: string; maxNotionalMinor?: bigint }
  | { action: 'halt_live_crypto'; reason: string };

export interface CryptoDefensePolicy {
  minimumThreatForExit: CryptoThreatLevel;
  haltOnSimulationFailure: boolean;
  haltOnCriticalSignal: boolean;
}

const severityRank: Record<CryptoThreatLevel, number> = {
  clear: 0,
  watch: 1,
  elevated: 2,
  critical: 3,
};

/**
 * Deterministic defense decision. This layer never broadcasts transactions,
 * changes gas fees, or attempts to outrun another participant's transaction.
 * It produces a governed exit/halt intent for the normal execution boundary.
 */
export function evaluateCryptoDefense(
  signals: readonly CryptoThreatSignal[],
  policy: CryptoDefensePolicy,
): CryptoDefenseDecision {
  if (signals.length === 0) return { action: 'monitor', reason: 'No active threat signals.' };

  const highest = signals.reduce((max, signal) =>
    severityRank[signal.severity] > severityRank[max.severity] ? signal : max,
  );

  if (policy.haltOnSimulationFailure && signals.some((s) => s.kind === 'simulation_failure')) {
    return { action: 'halt_live_crypto', reason: 'Transaction simulation failed for a monitored position.' };
  }

  if (policy.haltOnCriticalSignal && highest.severity === 'critical') {
    return { action: 'halt_live_crypto', reason: `Critical crypto threat: ${highest.kind}.` };
  }

  if (severityRank[highest.severity] >= severityRank[policy.minimumThreatForExit]) {
    return { action: 'request_exit', reason: `Threat threshold reached: ${highest.kind}.` };
  }

  return { action: 'block_new_exposure', reason: `Elevated crypto threat: ${highest.kind}.` };
}
