// CI marker for the reorg-safe checkpoint branch. The substantive coverage lives in bitcoin-payout-checkpoint.test.ts.
import { describe, it, expect } from 'vitest';

describe('reorg-safe checkpoint CI marker', () => {
  it('is present on the validation branch', () => {
    expect(true).toBe(true);
  });
});
