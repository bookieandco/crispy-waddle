import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseMiningPayoutCheckpointStore, type SupabaseMiningCheckpointClient } from '../src/supabase-mining-payout-checkpoint.ts';

function fakeClient() {
  let row: any = null;
  const calls: any[] = [];

  const client: SupabaseMiningCheckpointClient = {
    from() {
      return {
        select() {
          return {
            eq(_column: string, _value: string) {
              return {
                eq(_column2: string, _value2: string) {
                  return {
                    async maybeSingle() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    async rpc(_name, args) {
      calls.push(args);
      row = {
        network: args.p_network,
        receiving_address: args.p_receiving_address,
        scanner_version: args.p_scanner_version,
        last_scanned_height: args.p_last_scanned_height,
        last_scanned_hash: args.p_last_scanned_hash,
        last_successful_scan_at: args.p_last_successful_scan_at,
        reorg_lookback: args.p_reorg_lookback,
      };
      return { data: row, error: null };
    },
  };

  return { client, calls };
}

test('Supabase checkpoint store round-trips a checkpoint and commits through the atomic RPC', async () => {
  const { client, calls } = fakeClient();
  const store = new SupabaseMiningPayoutCheckpointStore(client, {
    network: 'mainnet',
    scannerVersion: 'v1',
    reorgLookback: 12,
  });

  const checkpoint = {
    height: 900000,
    blockHash: '000000abc',
    scannedAt: '2026-08-12T19:30:00Z',
  };

  await store.save('bc1qexample', checkpoint);
  assert.deepEqual(await store.load('bc1qexample'), checkpoint);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].p_network, 'mainnet');
  assert.equal(calls[0].p_receiving_address, 'bc1qexample');
});

test('Supabase checkpoint store surfaces load failures', async () => {
  const base = fakeClient().client;
  const client: SupabaseMiningCheckpointClient = {
    ...base,
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: null, error: { message: 'db unavailable' } };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const store = new SupabaseMiningPayoutCheckpointStore(client, { network: 'mainnet', scannerVersion: 'v1' });
  await assert.rejects(() => store.load('bc1qexample'), /MINING_CHECKPOINT_LOAD_FAILED/);
});
