import type { Evidence, MarketSnapshot, SharkDecision, SharkPolicy, SocialSignal, WalletSignal } from './contracts.js';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export interface SharkInput {
  market: MarketSnapshot;
  evidence?: Evidence[];
  social?: SocialSignal[];
  wallets?: WalletSignal[];
  policy?: Partial<SharkPolicy>;
}

const DEFAULT_POLICY: SharkPolicy = {
  minScore: 68,
  maxRugRisk: 35,
  minLiquidityUsd: 25_000,
  maxTop10HolderPct: 65,
  requireAuthorityChecks: true,
  requireSocialConfirmation: false,
  requireSmartMoneyConfirmation: false,
};

/**
 * Deterministic first-pass judgment. The LLM can explain this result, but it
 * does not get to override hard stops. This is the "street smarts" layer:
 * velocity is useful only when liquidity, ownership, and behavior agree.
 */
export function scoreMemecoin(input: SharkInput): SharkDecision {
  const policy = { ...DEFAULT_POLICY, ...input.policy };
  const m = input.market;
  const evidence = [...(input.evidence ?? [])];
  const social = input.social ?? [];
  const wallets = input.wallets ?? [];
  const reasons: string[] = [];
  const hardStops: string[] = [];

  const buyPressure = m.buys5m + m.sells5m > 0
    ? (m.buys5m / (m.buys5m + m.sells5m)) * 100
    : 0;
  const momentum = clamp(
    m.priceChange5mPct * 1.8 + m.priceChange1hPct * 0.45 + (buyPressure - 50) * 0.55 + Math.log10(Math.max(1, m.volume5mUsd)) * 4,
  );

  const liquidityQuality = clamp(
    Math.log10(Math.max(1, m.liquidityUsd)) * 13 + (m.lpLockedOrBurned ? 15 : 0) - (m.liquidityUsd < policy.minLiquidityUsd ? 35 : 0),
  );

  const concentrationPenalty = m.top10HolderPct == null ? 10 : Math.max(0, m.top10HolderPct - 45) * 1.35;
  const authorityPenalty = policy.requireAuthorityChecks
    ? (m.mintAuthorityRevoked === false ? 22 : 0) + (m.freezeAuthorityRevoked === false ? 18 : 0)
    : 0;
  const deployerPenalty = Math.max(0, m.deployerSoldPct ?? 0) * 0.9;
  const migrationPenalty = m.migrationDetected ? 45 : 0;
  const rugRisk = clamp(concentrationPenalty + authorityPenalty + deployerPenalty + migrationPenalty + (m.liquidityUsd < policy.minLiquidityUsd ? 25 : 0));

  const smartMoneyWallets = wallets.filter(w => w.role === 'smart-money' || w.role === 'early-buyer');
  const smartMoney = clamp(
    smartMoneyWallets.reduce((sum, w) => sum + Math.max(0, w.confidence) * (w.behavior === 'accumulating' ? 1 : w.behavior === 'distributing' ? -1 : 0.15), 0) * 0.7 + (smartMoneyWallets.length ? 15 : 0),
  );

  const relevantSocial = social.filter(s => s.classification === 'memecoin' || s.classification === 'promotion');
  const scamSocial = social.filter(s => s.classification === 'scam-pattern' || s.coordinated);
  const socialQuality = clamp(
    relevantSocial.length * 7 + relevantSocial.reduce((sum, s) => sum + (s.engagement ?? 0) ** 0.5, 0) * 0.5 - scamSocial.length * 18,
  );

  const narrativeStrength = clamp(
    relevantSocial.filter(s => s.sentiment === 'bullish').length * 8 + (m.volume5mUsd > m.volume1hUsd / 12 ? 15 : 0) - scamSocial.length * 12,
  );

  if (m.liquidityUsd < policy.minLiquidityUsd) hardStops.push('Liquidity below policy floor.');
  if (rugRisk > policy.maxRugRisk) hardStops.push(`Rug risk ${rugRisk.toFixed(1)} exceeds policy ceiling.`);
  if ((m.top10HolderPct ?? 0) > policy.maxTop10HolderPct) hardStops.push('Holder concentration exceeds policy ceiling.');
  if (m.mintAuthorityRevoked === false && policy.requireAuthorityChecks) hardStops.push('Mint authority is not revoked.');
  if (m.freezeAuthorityRevoked === false && policy.requireAuthorityChecks) hardStops.push('Freeze authority is not revoked.');
  if (m.migrationDetected) hardStops.push('Migration detected; re-underwrite the token before entry.');
  if (policy.requireSocialConfirmation && relevantSocial.length === 0) hardStops.push('Required social confirmation is missing.');
  if (policy.requireSmartMoneyConfirmation && smartMoneyWallets.length === 0) hardStops.push('Required smart-money confirmation is missing.');

  const score = clamp(
    momentum * 0.28 + liquidityQuality * 0.22 + smartMoney * 0.2 + socialQuality * 0.12 + narrativeStrength * 0.08 + (100 - rugRisk) * 0.1,
  );

  if (rugRisk > 70 || hardStops.length >= 2) {
    reasons.push('Capital-preservation posture: multiple independent danger signals agree.');
  } else if (score >= policy.minScore && rugRisk <= policy.maxRugRisk) {
    reasons.push('Momentum, liquidity, wallet behavior and narrative are aligned.');
  } else {
    reasons.push('Interesting enough to watch, but evidence is not yet strong enough for a buy candidate.');
  }

  if (buyPressure >= 65) reasons.push('Buy pressure is elevated.');
  if (m.lpLockedOrBurned) reasons.push('Liquidity-control signal is favorable.');
  if (smartMoneyWallets.some(w => w.behavior === 'accumulating')) reasons.push('Tracked high-signal wallets are accumulating.');
  if (scamSocial.length) reasons.push('Social stream contains manipulation/scam-pattern evidence.');

  return {
    mint: m.mint,
    action: hardStops.length ? (rugRisk >= 70 ? 'avoid' : 'watch') : score >= policy.minScore ? 'buy-candidate' : 'watch',
    score: Number(score.toFixed(2)),
    confidence: Number(clamp(40 + evidence.length * 4 + Math.min(25, relevantSocial.length * 3) + Math.min(20, wallets.length * 2)).toFixed(2)),
    rugRisk: Number(rugRisk.toFixed(2)),
    momentum: Number(momentum.toFixed(2)),
    smartMoney: Number(smartMoney.toFixed(2)),
    socialQuality: Number(socialQuality.toFixed(2)),
    narrativeStrength: Number(narrativeStrength.toFixed(2)),
    liquidityQuality: Number(liquidityQuality.toFixed(2)),
    reasons,
    hardStops,
    evidence,
    createdAt: new Date().toISOString(),
    modelVersion: 'shark-v1-deterministic',
  };
}
