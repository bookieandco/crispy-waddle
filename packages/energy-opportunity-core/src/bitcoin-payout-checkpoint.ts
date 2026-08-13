import type { BitcoinCoreDiscoveryClient } from './bitcoin-payout-discovery.ts';
import { discoverBitcoinPayouts, type BitcoinPayoutCheckpoint, type DiscoveredBitcoinPayout } from './bitcoin-payout-discovery.ts';

export interface BitcoinPayoutCheckpointStore {
  load(walletAddress: string): Promise<BitcoinPayoutCheckpoint | null>;
  save(walletAddress: string, checkpoint: BitcoinPayoutCheckpoint): Promise<void>;
}

export class InMemoryBitcoinPayoutCheckpointStore implements BitcoinPayoutCheckpointStore {
  private readonly values = new Map<string, BitcoinPayoutCheckpoint>();

  async load(walletAddress: string): Promise<BitcoinPayoutCheckpoint | null> {
    return this.values.get(walletAddress) ?? null;
  }

  async save(walletAddress: string, checkpoint: BitcoinPayoutCheckpoint): Promise<void> {
    this.values.set(walletAddress, { ...checkpoint });
  }
}

export interface ScanBitcoinPayoutsInput {
  client: BitcoinCoreDiscoveryClient;
  checkpointStore: BitcoinPayoutCheckpointStore;
  walletAddress: string;
  startHeight: number;
  minimumConfirmations?: number;
  reorgLookback?: number;
  now?: string;
}

export interface ScanBitcoinPayoutsResult {
  payouts: DiscoveredBitcoinPayout[];
  checkpoint: BitcoinPayoutCheckpoint;
  reorgDetected: boolean;
  rescannedFromHeight: number;
}

/**
 * Resumable, read-only scanner. A checkpoint is committed only after the scan succeeds.
 * A changed checkpoint block hash causes a bounded rewind to cover a possible reorg.
 */
export async function scanBitcoinPayouts(input: ScanBitcoinPayoutsInput): Promise<ScanBitcoinPayoutsResult> {
  const previous = await input.checkpointStore.load(input.walletAddress);
  const lookback = Math.max(1, input.reorgLookback ?? 12);
  let fromHeight = previous ? Math.max(input.startHeight, previous.height - lookback + 1) : input.startHeight;
  let reorgDetected = false;

  if (previous) {
    const currentHash = await input.client.getBlockHash(previous.height);
    if (currentHash !== previous.blockHash) {
      reorgDetected = true;
      fromHeight = Math.max(input.startHeight, previous.height - lookback + 1);
    }
  }

  const result = await discoverBitcoinPayouts({
    client: input.client,
    walletAddress: input.walletAddress,
    fromHeight,
    minimumConfirmations: input.minimumConfirmations,
    now: input.now,
  });

  await input.checkpointStore.save(input.walletAddress, result.checkpoint);
  return { ...result, reorgDetected, rescannedFromHeight: fromHeight };
}
