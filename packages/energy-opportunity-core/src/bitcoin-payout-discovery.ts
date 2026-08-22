import type { BitcoinCoreTransaction, BitcoinCoreVout } from './bitcoin-core.ts';

export interface BitcoinCoreBlockTransaction extends BitcoinCoreTransaction {
  blockHash: string;
  blockHeight: number;
}

export interface BitcoinCoreDiscoveryClient {
  getBlockCount(): Promise<number>;
  getBlockHash(height: number): Promise<string>;
  getBlockTransactions(blockHash: string): Promise<BitcoinCoreBlockTransaction[]>;
}

export interface BitcoinPayoutCheckpoint {
  height: number;
  blockHash: string;
  scannedAt: string;
}

export interface DiscoveredBitcoinPayout {
  txid: string;
  blockHash: string;
  blockHeight: number;
  confirmations: number;
  amountBtc: number;
  walletAddress: string;
}

export interface DiscoverBitcoinPayoutsInput {
  client: BitcoinCoreDiscoveryClient;
  walletAddress: string;
  fromHeight: number;
  toHeight?: number;
  minimumConfirmations?: number;
  now?: string;
}

export interface DiscoverBitcoinPayoutsResult {
  payouts: DiscoveredBitcoinPayout[];
  checkpoint: BitcoinPayoutCheckpoint;
}

export async function discoverBitcoinPayouts(input: DiscoverBitcoinPayoutsInput): Promise<DiscoverBitcoinPayoutsResult> {
  if (!input.walletAddress) throw new Error('WALLET_ADDRESS_REQUIRED');
  if (input.fromHeight < 0 || !Number.isInteger(input.fromHeight)) throw new Error('INVALID_FROM_HEIGHT');

  const tip = await input.client.getBlockCount();
  const toHeight = Math.min(input.toHeight ?? tip, tip);
  if (toHeight < input.fromHeight) {
    const hash = await input.client.getBlockHash(input.fromHeight);
    return { payouts: [], checkpoint: { height: input.fromHeight, blockHash: hash, scannedAt: input.now ?? new Date().toISOString() } };
  }

  const minimumConfirmations = Math.max(1, input.minimumConfirmations ?? 1);
  const payouts: DiscoveredBitcoinPayout[] = [];

  for (let height = input.fromHeight; height <= toHeight; height += 1) {
    const blockHash = await input.client.getBlockHash(height);
    const transactions = await input.client.getBlockTransactions(blockHash);
    const confirmations = tip - height + 1;

    for (const tx of transactions) {
      if (tx.blockHash !== blockHash || tx.blockHeight !== height || confirmations < minimumConfirmations) continue;
      const amountBtc = tx.vout
        .filter((output: BitcoinCoreVout) => output.addresses.includes(input.walletAddress))
        .reduce((sum, output) => sum + Math.max(0, output.valueBtc), 0);
      if (amountBtc <= 0) continue;
      payouts.push({ txid: tx.txid, blockHash, blockHeight: height, confirmations, amountBtc, walletAddress: input.walletAddress });
    }
  }

  const finalHash = await input.client.getBlockHash(toHeight);
  return { payouts, checkpoint: { height: toHeight, blockHash: finalHash, scannedAt: input.now ?? new Date().toISOString() } };
}
