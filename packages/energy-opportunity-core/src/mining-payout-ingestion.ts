import type { MiningPayoutVerifiedEvent } from './financial-events.ts';
import { verifyMiningPayout } from './bitcoin-core.ts';
import type { BitcoinCoreReadClient, VerifyMiningPayoutInput } from './bitcoin-core.ts';

export interface MiningPayoutIngestionInput extends VerifyMiningPayoutInput {
  eventId?: string;
}

/**
 * Read-only payout ingestion boundary. It verifies a transaction against Bitcoin Core
 * and emits a governed financial event. It never signs, sends, or stores credentials.
 */
export async function ingestMiningPayout(
  client: BitcoinCoreReadClient,
  input: MiningPayoutIngestionInput,
): Promise<MiningPayoutVerifiedEvent | null> {
  const verified = await verifyMiningPayout(client, input);
  if (!verified) return null;

  return Object.freeze({
    schemaVersion: 1 as const,
    eventId: input.eventId ?? `mining-payout:${verified.txid}:${verified.payoutId}`,
    kind: 'mining_payout_verified' as const,
    resourceId: verified.resourceId,
    occurredAt: verified.verifiedAt,
    currency: 'BTC' as const,
    source: 'bitcoin-core' as const,
    immutable: true as const,
    walletAddress: verified.walletAddress,
    txid: verified.txid,
    amountBtc: verified.amountBtc,
    confirmations: verified.confirmations,
    verifiedAt: verified.verifiedAt,
  });
}
