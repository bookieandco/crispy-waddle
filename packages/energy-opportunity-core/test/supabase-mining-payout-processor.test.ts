import assert from 'node:assert/strict';
import test from 'node:test';
import { processSupabaseMiningPayout } from '../src/supabase-mining-payout-processor.ts';

test('Supabase adapter calls the transactional payout RPC', async () => {
  let call: { name: string; args: Record<string, unknown> } | undefined;
  const result = await processSupabaseMiningPayout({
    client: { rpc: async (name, args) => {
      call = { name, args };
      return { data: { processed: true, checkpoint_height: 900, checkpoint_hash: 'abc' }, error: null };
    } },
    network: 'bitcoin-mainnet',
    walletAddress: 'bc1qexample',
    checkpoint: { height: 900, blockHash: 'abc', scannedAt: '2026-08-12T20:00:00Z' },
    payout: { txid: 'tx123', outputIndex: 1, amountSats: 12345 },
  });
  assert.equal(result, 'processed');
  assert.equal(call?.name, 'process_jhadina_mining_payout');
  assert.deepEqual(call?.args, {
    p_network: 'bitcoin-mainnet', p_receiving_address: 'bc1qexample', p_txid: 'tx123',
    p_output_index: 1, p_payout_sats: 12345, p_block_height: 900, p_block_hash: 'abc',
    p_scanned_at: '2026-08-12T20:00:00Z',
  });
});

test('duplicate result is preserved', async () => {
  const result = await processSupabaseMiningPayout({
    client: { rpc: async () => ({ data: { processed: false, checkpoint_height: 900, checkpoint_hash: 'abc' }, error: null }) },
    network: 'bitcoin-mainnet', walletAddress: 'bc1qexample',
    checkpoint: { height: 900, blockHash: 'abc', scannedAt: '2026-08-12T20:00:00Z' },
    payout: { txid: 'tx123', outputIndex: 1, amountSats: 12345 },
  });
  assert.equal(result, 'duplicate');
});

test('RPC errors are surfaced', async () => {
  await assert.rejects(() => processSupabaseMiningPayout({
    client: { rpc: async () => ({ data: null, error: { message: 'database unavailable' } }) },
    network: 'bitcoin-mainnet', walletAddress: 'bc1qexample',
    checkpoint: { height: 900, blockHash: 'abc', scannedAt: '2026-08-12T20:00:00Z' },
    payout: { txid: 'tx123', outputIndex: 1, amountSats: 12345 },
  }), /database unavailable/);
});

test('missing RPC result is rejected', async () => {
  await assert.rejects(() => processSupabaseMiningPayout({
    client: { rpc: async () => ({ data: null, error: null }) },
    network: 'bitcoin-mainnet', walletAddress: 'bc1qexample',
    checkpoint: { height: 900, blockHash: 'abc', scannedAt: '2026-08-12T20:00:00Z' },
    payout: { txid: 'tx123', outputIndex: 1, amountSats: 12345 },
  }), /returned no result/);
});
