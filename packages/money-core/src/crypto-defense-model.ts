export type CryptoDefenseMode = 'paper' | 'live';
export type CryptoThreatLevel = 'clear' | 'watch' | 'elevated' | 'critical';

export interface LiquidityLockObservation {
  locker: string;
  token: string;
  pool: string;
  amountRaw: bigint;
  unlockAt: string;
  verified: boolean;
}

export interface TokenSecuritySnapshot {
  token: string;
  chain: string;
  owner?: string;
  ownershipRenounced?: boolean;
  mintAuthorityActive?: boolean;
  tradingPaused?: boolean;
  maxTransactionRaw?: bigint;
  sellTaxBps?: number;
  upgradeable?: boolean;
  sourceVerified?: boolean;
  liquidityLocks: LiquidityLockObservation[];
}

export interface SimulationResult {
  mode: 'fork' | 'provider';
  buySucceeded: boolean;
  sellSucceeded: boolean;
  expectedOutputRaw?: bigint;
  simulatedOutputRaw?: bigint;
  effectiveFeeBps?: number;
  revertReason?: string;
}

export interface CryptoPreTradeDecision {
  allowed: boolean;
  threat: CryptoThreatLevel;
  reasons: string[];
}

export function evaluateTokenSecurity(snapshot: TokenSecuritySnapshot, simulation?: SimulationResult): CryptoPreTradeDecision {
  const reasons: string[] = [];
  let threat: CryptoThreatLevel = 'clear';

  const elevate = (next: CryptoThreatLevel, reason: string) => {
    const rank: Record<CryptoThreatLevel, number> = { clear: 0, watch: 1, elevated: 2, critical: 3 };
    if (rank[next] > rank[threat]) threat = next;
    reasons.push(reason);
  };

  if (snapshot.mintAuthorityActive) elevate('elevated', 'Mint authority remains active');
  if (snapshot.upgradeable) elevate('watch', 'Contract is upgradeable');
  if (snapshot.tradingPaused) elevate('critical', 'Trading is paused or restricted');
  if (snapshot.sellTaxBps !== undefined && snapshot.sellTaxBps >= 9000) elevate('critical', 'Effective sell tax is at or above 90%');
  else if (snapshot.sellTaxBps !== undefined && snapshot.sellTaxBps >= 2000) elevate('elevated', 'Sell tax is at or above 20%');
  if (snapshot.sourceVerified === false) elevate('watch', 'Contract source is not verified');
  if (snapshot.liquidityLocks.some(lock => !lock.verified)) elevate('watch', 'Liquidity lock could not be independently verified');

  if (simulation) {
    if (!simulation.buySucceeded) elevate('critical', 'Simulated buy failed');
    if (!simulation.sellSucceeded) elevate('critical', 'Simulated sell failed');
    if (simulation.effectiveFeeBps !== undefined && simulation.effectiveFeeBps >= 9000) elevate('critical', 'Simulation indicates an extreme effective fee');
  }

  return { allowed: threat === 'clear' || threat === 'watch', threat, reasons };
}

export interface DefenseRun {
  mode: CryptoDefenseMode;
  token: string;
  decision: CryptoPreTradeDecision;
  simulation?: SimulationResult;
  createdAt: string;
}
