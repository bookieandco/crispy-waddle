import assert from 'node:assert/strict';
import test from 'node:test';
import { createMiningScanRunner } from '../src/mining-scan-runner.ts';

test('runner rejects overlapping scans and releases the lock after completion', async () => {
  let release!: () => void;
  let entered = false;
  const input: any = {
    checkpointStore: { load: async () => null, save: async () => {} },
    client: {
      getBlockCount: async () => 100,
      getBlockHash: async () => 'h',
      getBlock: async () => { entered = true; await new Promise<void>(r => { release = r; }); return { height: 1, hash: 'h', tx: [] }; },
      getRawTransaction: async () => ({ txid: 'x', confirmations: 100, vout: [] }),
    },
    walletAddress: 'bc1qexample',
    startHeight: 1,
    minimumConfirmations: 1,
  };
  const runner = createMiningScanRunner(input);
  const first = runner.run();
  while (!entered) await new Promise(r => setTimeout(r, 0));
  await assert.rejects(() => runner.run(), /MINING_SCAN_ALREADY_RUNNING/);
  release();
  await first;
  await runner.run();
});
