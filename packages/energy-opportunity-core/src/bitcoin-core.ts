export interface BitcoinCoreVout {
  valueBtc: number;
  addresses: string[];
}

export interface BitcoinCoreTransaction {
  txid: string;
  confirmations: number;
  vout: BitcoinCoreVout[];
}

/** Read-only interface to Bitcoin Core's transaction lookup RPC. */
export interface BitcoinCoreReadClient {
  getTransaction(txid: string): Promise<BitcoinCoreTransaction>;
}

export interface VerifyMiningPayoutInput {
  payoutId: string;
  txid: string;
  walletAddress: string;
  minimumConfirmations?: number;
  resourceId: string;
  verifiedAt?: string;
}

export interface VerifiedBitcoinPayout {
  payoutId: string;
  resourceId: string;
  walletAddress: string;
  txid: string;
  amountBtc: number;
  confirmations: number;
  verifiedAt: string;
  source: 'bitcoin-core';
}

/**
 * Verifies a payout against independently queried Bitcoin Core transaction data.
 * This function never signs, sends, or stores wallet credentials.
 */
export async function verifyMiningPayout(
  client: BitcoinCoreReadClient,
  input: VerifyMiningPayoutInput,
): Promise<VerifiedBitcoinPayout | null> {
  if (!input.txid || !input.walletAddress || !input.resourceId) return null;

  const minimumConfirmations = Math.max(1, input.minimumConfirmations ?? 1);
  const tx = await client.getTransaction(input.txid);
  if (tx.txid !== input.txid || tx.confirmations < minimumConfirmations) return null;

  const matchingOutputs = tx.vout.filter((output) => output.addresses.includes(input.walletAddress));
  const amountBtc = matchingOutputs.reduce((sum, output) => sum + Math.max(0, output.valueBtc), 0);
  if (amountBtc <= 0) return null;

  return {
    payoutId: input.payoutId,
    resourceId: input.resourceId,
    walletAddress: input.walletAddress,
    txid: input.txid,
    amountBtc,
    confirmations: tx.confirmations,
    verifiedAt: input.verifiedAt ?? new Date().toISOString(),
    source: 'bitcoin-core',
  };
}
