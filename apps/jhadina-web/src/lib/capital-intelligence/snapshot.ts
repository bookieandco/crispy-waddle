import type { CapitalBucket, CapitalPosition, Money } from './domain';

export type CapitalLabSnapshotLike = {
  connected: boolean;
  provider: string;
  assets: Array<{ asset: string; available: string; hold: string }>;
  capabilities: {
    balances: boolean;
    accounts: boolean;
    trading: boolean;
    transfers: boolean;
    withdrawals: boolean;
  };
};

const BUCKET_ASSET_MAP: Record<string, CapitalBucket> = {
  USD: 'unallocated',
  USDC: 'unallocated',
  USDT: 'speculative',
  BTC: 'speculative',
  ETH: 'speculative',
};

export function snapshotToCapitalPositions(snapshot: CapitalLabSnapshotLike): CapitalPosition[] {
  const byBucket = new Map<CapitalBucket, Money>();
  for (const asset of snapshot.assets) {
    const amount = Number(asset.available);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const bucket = BUCKET_ASSET_MAP[asset.asset.toUpperCase()] ?? 'unallocated';
    const currency = /^[A-Z]{3}$/.test(asset.asset) ? asset.asset.toUpperCase() : 'USD';
    const current = byBucket.get(bucket);
    if (!current) byBucket.set(bucket, { amount, currency });
    else if (current.currency === currency) current.amount += amount;
  }
  return [...byBucket.entries()].map(([bucket, balance]) => ({ bucket, balance }));
}
