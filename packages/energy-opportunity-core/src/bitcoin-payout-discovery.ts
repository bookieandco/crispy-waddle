/**
 * Read-only Bitcoin Core RPC surface this package depends on. No signing,
 * no wallet, no broadcast capability — discovery only.
 */
export interface BitcoinCoreDiscoveryClient {
  getBlockCount(): Promise<number>;
  getBlockHash(height: number): Promise<string>;
  getBlockTransactions(blockHash: string): Promise<BitcoinCoreBlockTransaction[]>;
}

/** A decoded transaction as Bitcoin Core's verbose block/transaction RPCs return it. */
export interface BitcoinCoreBlockTransaction {
  txid: string;
  vout: Array<{
    n: number;
    /** BTC, matching Bitcoin Core's decoded-transaction convention (not satoshis). */
    value: number;
    scriptPubKey?: {
      address?: string;
      addresses?: string[];
    };
  }>;
}

export interface BitcoinPayoutCheckpoint {
  height: number;
  blockHash: string;
}

export interface DiscoveredBitcoinPayout {
  txid: string;
  voutIndex: number;
  address: string;
  amountSats: number;
  blockHeight: number;
  blockHash: string;
  confirmations: number;
  observedAt: string;
}

export interface DiscoverBitcoinPayoutsInput {
  client: BitcoinCoreDiscoveryClient;
  walletAddress: string;
  fromHeight: number;
  minimumConfirmations?: number;
  now?: string;
}

export interface DiscoverBitcoinPayoutsResult {
  payouts: DiscoveredBitcoinPayout[];
  checkpoint: BitcoinPayoutCheckpoint;
}

const SATS_PER_BTC = 100_000_000;

function outputAddresses(vout: BitcoinCoreBlockTransaction['vout'][number]): string[] {
  if (vout.scriptPubKey?.address) return [vout.scriptPubKey.address];
  if (vout.scriptPubKey?.addresses) return vout.scriptPubKey.addresses;
  return [];
}

/**
 * Walk blocks [fromHeight, tip] once, in order, and return every output paying
 * the wallet address plus a checkpoint at the tip actually reached. Read-only:
 * no wallet, no signing, no broadcast. Any client error propagates unmodified —
 * callers (see bitcoin-payout-checkpoint.ts) rely on that to avoid persisting a
 * checkpoint for a scan that didn't actually complete.
 */
export async function discoverBitcoinPayouts(
  input: DiscoverBitcoinPayoutsInput,
): Promise<DiscoverBitcoinPayoutsResult> {
  const observedAt = input.now ?? new Date().toISOString();
  const minimumConfirmations = Math.max(0, input.minimumConfirmations ?? 0);
  const tip = await input.client.getBlockCount();

  const payouts: DiscoveredBitcoinPayout[] = [];
  let lastHash: string | null = null;

  for (let height = input.fromHeight; height <= tip; height += 1) {
    const blockHash = await input.client.getBlockHash(height);
    const confirmations = tip - height + 1;

    if (confirmations >= Math.max(1, minimumConfirmations)) {
      const transactions = await input.client.getBlockTransactions(blockHash);
      for (const tx of transactions) {
        for (const vout of tx.vout) {
          if (!outputAddresses(vout).includes(input.walletAddress)) continue;
          payouts.push({
            txid: tx.txid,
            voutIndex: vout.n,
            address: input.walletAddress,
            amountSats: Math.round(vout.value * SATS_PER_BTC),
            blockHeight: height,
            blockHash,
            confirmations,
            observedAt,
          });
        }
      }
    }

    lastHash = blockHash;
  }

  const checkpointHash = lastHash ?? (tip > 0 ? await input.client.getBlockHash(tip) : '');

  return {
    payouts,
    checkpoint: { height: tip, blockHash: checkpointHash },
  };
}
