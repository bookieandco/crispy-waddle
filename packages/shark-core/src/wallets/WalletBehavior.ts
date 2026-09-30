import type { SharkChain } from './MultiChainWallet';

export type WalletBehaviorSignal =
  | 'early_entry'
  | 'early_exit'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'large_transfer'
  | 'funding_source'
  | 'coordinated_activity'
  | 'repeat_deployer_exposure'
  | 'wash_like_activity';

export interface WalletBehaviorEvent {
  readonly walletId: string;
  readonly chain: SharkChain;
  readonly address: string;
  readonly signal: WalletBehaviorSignal;
  readonly observedAt: string;
  readonly tokenId?: string;
  readonly counterpartyId?: string;
  readonly valueUsd?: number;
  readonly evidenceIds: readonly string[];
}

export interface WalletBehaviorProfile {
  readonly walletId: string;
  readonly eventCount: number;
  readonly signals: Readonly<Partial<Record<WalletBehaviorSignal, number>>>;
  readonly realizedWins: number;
  readonly realizedLosses: number;
  readonly observedRugs: number;
  readonly confidence: number;
}

/**
 * Descriptive statistics only. It deliberately does not produce a buy/sell
 * decision. The decision layer can consume this profile later.
 */
export function buildWalletBehaviorProfile(
  walletId: string,
  events: readonly WalletBehaviorEvent[],
  outcomes: ReadonlyArray<'win' | 'loss' | 'rug'> = [],
): WalletBehaviorProfile {
  const mine = events.filter((event) => event.walletId === walletId);
  const signals: Partial<Record<WalletBehaviorSignal, number>> = {};

  for (const event of mine) {
    signals[event.signal] = (signals[event.signal] ?? 0) + 1;
  }

  const evidenceBacked = mine.filter((event) => event.evidenceIds.length > 0).length;
  const confidence = mine.length === 0 ? 0 : evidenceBacked / mine.length;

  return {
    walletId,
    eventCount: mine.length,
    signals,
    realizedWins: outcomes.filter((outcome) => outcome === 'win').length,
    realizedLosses: outcomes.filter((outcome) => outcome === 'loss').length,
    observedRugs: outcomes.filter((outcome) => outcome === 'rug').length,
    confidence,
  };
}
