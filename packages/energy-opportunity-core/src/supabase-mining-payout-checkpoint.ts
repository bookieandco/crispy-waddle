import type { BitcoinPayoutCheckpoint, BitcoinPayoutCheckpointStore } from './bitcoin-payout-checkpoint.ts';

type SupabaseError = { message: string } | null;

type CheckpointRow = {
  network: string;
  receiving_address: string;
  scanner_version: string;
  last_scanned_height: number;
  last_scanned_hash: string;
  last_successful_scan_at: string;
  reorg_lookback: number;
};

export interface SupabaseMiningCheckpointClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: CheckpointRow | null; error: SupabaseError }>;
        };
      };
    };
  };
  rpc(
    functionName: 'commit_jhadina_mining_scan_checkpoint',
    args: {
      p_network: string;
      p_receiving_address: string;
      p_scanner_version: string;
      p_last_scanned_height: number;
      p_last_scanned_hash: string;
      p_last_successful_scan_at: string;
      p_reorg_lookback: number;
    },
  ): Promise<{ data: CheckpointRow | null; error: SupabaseError }>;
}

export interface SupabaseMiningPayoutCheckpointStoreOptions {
  network: string;
  scannerVersion: string;
  reorgLookback?: number;
}

/**
 * Durable checkpoint store for the read-only Bitcoin payout scanner.
 * The injected client is intentionally structural so the core package does not
 * take a hard dependency on a particular Supabase SDK version.
 */
export class SupabaseMiningPayoutCheckpointStore implements BitcoinPayoutCheckpointStore {
  private readonly network: string;
  private readonly scannerVersion: string;
  private readonly reorgLookback: number;

  constructor(
    private readonly client: SupabaseMiningCheckpointClient,
    options: SupabaseMiningPayoutCheckpointStoreOptions,
  ) {
    this.network = options.network;
    this.scannerVersion = options.scannerVersion;
    this.reorgLookback = options.reorgLookback ?? 12;
  }

  async load(walletAddress: string): Promise<BitcoinPayoutCheckpoint | null> {
    const { data, error } = await this.client
      .from('jhadina_mining_scan_checkpoints')
      .select('network,receiving_address,scanner_version,last_scanned_height,last_scanned_hash,last_successful_scan_at,reorg_lookback')
      .eq('network', this.network)
      .eq('receiving_address', walletAddress)
      .maybeSingle();

    if (error) throw new Error(`MINING_CHECKPOINT_LOAD_FAILED: ${error.message}`);
    if (!data) return null;

    return {
      height: data.last_scanned_height,
      blockHash: data.last_scanned_hash,
      scannedAt: data.last_successful_scan_at,
    };
  }

  async save(walletAddress: string, checkpoint: BitcoinPayoutCheckpoint): Promise<void> {
    const { error } = await this.client.rpc('commit_jhadina_mining_scan_checkpoint', {
      p_network: this.network,
      p_receiving_address: walletAddress,
      p_scanner_version: this.scannerVersion,
      p_last_scanned_height: checkpoint.height,
      p_last_scanned_hash: checkpoint.blockHash,
      p_last_successful_scan_at: checkpoint.scannedAt,
      p_reorg_lookback: this.reorgLookback,
    });

    if (error) throw new Error(`MINING_CHECKPOINT_COMMIT_FAILED: ${error.message}`);
  }
}
