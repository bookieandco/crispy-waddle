import type { MiningPayoutIdentity, MiningPayoutTransactionFactory, MiningPayoutTransaction } from './mining-payout-processing.ts';

export interface SupabaseRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface SupabaseMiningPayoutProcessorInput {
  client: SupabaseRpcClient;
  network: string;
  walletAddress: string;
  checkpoint: { height: number; blockHash: string; scannedAt: string };
  payout: MiningPayoutIdentity & { amountSats: number };
}

/**
 * Production adapter for the database transaction boundary. The RPC owns
 * the PostgreSQL transaction; this adapter deliberately contains no wallet
 * credentials and never submits blockchain transactions.
 */
export class SupabaseMiningPayoutTransactionFactory implements MiningPayoutTransactionFactory {
  constructor(private readonly client: SupabaseRpcClient, private readonly input: Omit<SupabaseMiningPayoutProcessorInput, 'payout' | 'checkpoint'> & { checkpoint?: never }) {}

  async begin(): Promise<MiningPayoutTransaction> {
    throw new Error('Use processSupabaseMiningPayout: the payout and checkpoint must be supplied to the single RPC call');
  }
}

export async function processSupabaseMiningPayout(input: SupabaseMiningPayoutProcessorInput): Promise<'processed' | 'duplicate'> {
  const { data, error } = await input.client.rpc('process_jhadina_mining_payout', {
    p_network: input.network,
    p_receiving_address: input.walletAddress,
    p_txid: input.payout.txid,
    p_output_index: input.payout.outputIndex,
    p_amount_sats: input.payout.amountSats,
    p_block_height: input.checkpoint.height,
    p_block_hash: input.checkpoint.blockHash,
    p_scanned_at: input.checkpoint.scannedAt,
  });

  if (error) throw new Error(`mining payout RPC failed: ${error.message}`);
  if (data === 'duplicate') return 'duplicate';
  return 'processed';
}
