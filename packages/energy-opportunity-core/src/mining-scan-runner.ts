import { scanBitcoinPayouts, type ScanBitcoinPayoutsInput, type ScanBitcoinPayoutsResult } from './bitcoin-payout-checkpoint.ts';

export interface MiningScanRunner {
  run(): Promise<ScanBitcoinPayoutsResult>;
}

/** Prevents overlapping scheduled scans in a single process. */
export function createMiningScanRunner(input: ScanBitcoinPayoutsInput): MiningScanRunner {
  let running = false;
  return {
    async run() {
      if (running) throw new Error('MINING_SCAN_ALREADY_RUNNING');
      running = true;
      try {
        return await scanBitcoinPayouts(input);
      } finally {
        running = false;
      }
    },
  };
}
