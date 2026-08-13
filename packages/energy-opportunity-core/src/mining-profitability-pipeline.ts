import type { BitcoinCoreReadClient, VerifyMiningPayoutInput } from './bitcoin-core.ts';
import { verifyMiningPayout } from './bitcoin-core.ts';
import type { MiningFinancialEvent, MiningPayoutVerifiedEvent } from './financial-events.ts';
import { reconcileRealizedProfitability } from './realized-profitability.ts';
import type { ProfitabilitySnapshotLedger } from './profitability-snapshot.ts';
import { appendProfitabilitySnapshot } from './profitability-snapshot.ts';

export interface MiningProfitabilityPipelineInput {
  bitcoinCore: BitcoinCoreReadClient;
  payout: VerifyMiningPayoutInput;
  events: readonly MiningFinancialEvent[];
  snapshotLedger: ProfitabilitySnapshotLedger;
  btcUsdRate?: number;
}

export interface MiningProfitabilityPipelineResult {
  payout: MiningPayoutVerifiedEvent | null;
  snapshot: ReturnType<typeof appendProfitabilitySnapshot>;
}

function toVerifiedEvent(payout: NonNullable<Awaited<ReturnType<typeof verifyMiningPayout>>>): MiningPayoutVerifiedEvent {
  return {
    schemaVersion: 1,
    eventId: `mining-payout-verified:${payout.payoutId}:${payout.txid}`,
    kind: 'mining_payout_verified',
    resourceId: payout.resourceId,
    occurredAt: payout.verifiedAt,
    currency: 'BTC',
    source: 'bitcoin-core',
    immutable: true,
    walletAddress: payout.walletAddress,
    txid: payout.txid,
    amountBtc: payout.amountBtc,
    confirmations: payout.confirmations,
    verifiedAt: payout.verifiedAt,
  };
}

/**
 * Verifies one payout, adds it to the accounting event set, reconciles the
 * resource, and appends the resulting Money Core snapshot exactly once.
 * No wallet signing or custody occurs here.
 */
export async function ingestAndReconcileMiningPayout(
  input: MiningProfitabilityPipelineInput,
): Promise<MiningProfitabilityPipelineResult> {
  const verified = await verifyMiningPayout(input.bitcoinCore, input.payout);
  if (!verified) return { payout: null, snapshot: null };

  const payoutEvent = toVerifiedEvent(verified);
  const events = [...input.events.filter((event) => event.eventId !== payoutEvent.eventId), payoutEvent];
  const reconciliation = reconcileRealizedProfitability({
    resourceId: verified.resourceId,
    btcUsdRate: input.btcUsdRate,
    events,
  });

  const snapshot = appendProfitabilitySnapshot(input.snapshotLedger, {
    reconciliation,
    eventIds: events
      .filter((event) => event.resourceId === verified.resourceId)
      .map((event) => event.eventId),
    occurredAt: verified.verifiedAt,
  });

  return { payout: payoutEvent, snapshot };
}
