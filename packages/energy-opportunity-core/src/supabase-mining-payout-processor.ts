export interface SupabaseRpcClient {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{
    data: { processed: boolean; checkpoint_height: number; checkpoint_hash: string } | null;
    error: { message: string } | null;
  }>;
}

export interface SupabaseMiningPayoutProcessorInput {
  client: SupabaseRpcClient;
  network: string;
  walletAddress: string;
  checkpoint: { height: number; blockHash: string; scannedAt: string };
  payout: { txid: string; outputIndex: number; amountSats: number };
}

/**
 * Production adapter for the database transaction boundary. The RPC owns
 * the PostgreSQL transaction; this adapter contains no wallet credentials
 * and never submits blockchain transactions.
 */
export async function processSupabaseMiningPayout(
  input: SupabaseMiningPayoutProcessorInput,
): Promise<'processed' | 'duplicate'> {
  const { data, error } = await input.client.rpc('process_jhadina_mining_payout', {
    p_network: input.network,
    p_receiving_address: input.walletAddress,
    p_txid: input.payout.txid,
    p_output_index: input.payout.outputIndex,
    p_payout_sats: input.payout.amountSats,
    p_block_height: input.checkpoint.height,
    p_block_hash: input.checkpoint.blockHash,
    p_scanned_at: input.checkpoint.scannedAt,
  });

  if (error) throw new Error(`mining payout RPC failed: ${error.message}`);
  if (!data) throw new Error('mining payout RPC returned no result');
  return data.processed ? 'processed' : 'duplicate';
}
