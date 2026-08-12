export interface MiningPayoutIdentity {
  txid: string;
  outputIndex: number;
}

export interface MiningPayoutProcessor {
  /** Process a verified payout and advance the scanner checkpoint in one durable transaction. */
  process(
    payout: MiningPayoutIdentity,
    checkpoint: { height: number; blockHash: string; scannedAt: string },
  ): Promise<'processed' | 'duplicate'>;
}

export interface MiningPayoutTransaction {
  processVerifiedPayout(payout: MiningPayoutIdentity): Promise<'processed' | 'duplicate'>;
  commitCheckpoint(checkpoint: { height: number; blockHash: string; scannedAt: string }): Promise<void>;
  rollback(): Promise<void>;
}

export interface MiningPayoutTransactionFactory {
  begin(): Promise<MiningPayoutTransaction>;
}

/**
 * Coordinates payout idempotency and checkpoint advancement. The transaction
 * implementation owns the actual database transaction; this layer guarantees
 * that a checkpoint is never committed after payout processing fails.
 */
export class TransactionalMiningPayoutProcessor implements MiningPayoutProcessor {
  constructor(private readonly factory: MiningPayoutTransactionFactory) {}

  async process(
    payout: MiningPayoutIdentity,
    checkpoint: { height: number; blockHash: string; scannedAt: string },
  ): Promise<'processed' | 'duplicate'> {
    const tx = await this.factory.begin();
    try {
      const result = await tx.processVerifiedPayout(payout);
      await tx.commitCheckpoint(checkpoint);
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
}
