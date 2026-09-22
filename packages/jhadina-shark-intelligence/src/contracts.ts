export type SignalSource = 'dexscreener' | 'solana' | 'wallet' | 'x' | 'telegram' | 'token-security' | 'internal';

export type SignalKind =
  | 'liquidity'
  | 'volume'
  | 'price'
  | 'holder-concentration'
  | 'mint-authority'
  | 'freeze-authority'
  | 'lp-control'
  | 'deployer'
  | 'wallet-cluster'
  | 'smart-money'
  | 'social-velocity'
  | 'social-quality'
  | 'migration'
  | 'distribution'
  | 'narrative';

export interface Evidence {
  id: string;
  source: SignalSource;
  kind: SignalKind;
  observedAt: string;
  confidence: number;
  value: number | string | boolean;
  explanation: string;
  reference?: string;
}

export interface MarketSnapshot {
  mint: string;
  symbol?: string;
  chain: 'solana';
  priceUsd: number;
  liquidityUsd: number;
  volume5mUsd: number;
  volume1hUsd: number;
  priceChange5mPct: number;
  priceChange1hPct: number;
  buys5m: number;
  sells5m: number;
  holders?: number;
  top10HolderPct?: number;
  mintAuthorityRevoked?: boolean;
  freezeAuthorityRevoked?: boolean;
  lpLockedOrBurned?: boolean;
  deployerSoldPct?: number;
  migrationDetected?: boolean;
}

export interface SocialSignal {
  source: 'x' | 'telegram';
  observedAt: string;
  messageId: string;
  authorId?: string;
  text: string;
  engagement?: number;
  accountAgeDays?: number;
  classification: 'memecoin' | 'general-crypto' | 'news' | 'promotion' | 'scam-pattern' | 'noise';
  sentiment: 'bullish' | 'bearish' | 'mixed' | 'neutral';
  confidence: number;
  coordinated?: boolean;
}

export interface WalletSignal {
  wallet: string;
  role: 'deployer' | 'early-buyer' | 'smart-money' | 'funding-source' | 'cluster-member' | 'unknown';
  confidence: number;
  netFlowUsd: number;
  realizedPnlUsd?: number;
  winRate?: number;
  tokenCount?: number;
  linkedWallets?: string[];
  behavior: 'accumulating' | 'distributing' | 'flipping' | 'inactive' | 'unknown';
}

export interface SharkDecision {
  mint: string;
  action: 'watch' | 'paper-buy' | 'buy-candidate' | 'avoid' | 'exit';
  score: number;
  confidence: number;
  rugRisk: number;
  momentum: number;
  smartMoney: number;
  socialQuality: number;
  narrativeStrength: number;
  liquidityQuality: number;
  reasons: string[];
  hardStops: string[];
  evidence: Evidence[];
  createdAt: string;
  modelVersion: string;
}

export interface LearningOutcome {
  mint: string;
  decisionId: string;
  outcome: 'win' | 'loss' | 'avoided-loss' | 'missed-win' | 'expired';
  returnPct?: number;
  maxDrawdownPct?: number;
  timeToPeakMinutes?: number;
  realizedAt: string;
  featureSnapshot: Record<string, number>;
}

export interface SharkPolicy {
  minScore: number;
  maxRugRisk: number;
  minLiquidityUsd: number;
  maxTop10HolderPct: number;
  requireAuthorityChecks: boolean;
  requireSocialConfirmation: boolean;
  requireSmartMoneyConfirmation: boolean;
}
