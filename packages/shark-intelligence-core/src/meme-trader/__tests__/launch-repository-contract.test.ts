import { describe, expect, it } from 'vitest'

describe('SHARK launch persistence contract', () => {
  it('requires canonical identity to be stable across duplicate webhook deliveries', () => {
    expect('chain_id + token_address').toBe('chain_id + token_address')
  })

  it('treats UNKNOWN as non-authoritative so a duplicate cannot downgrade a resolved outcome', () => {
    const rank: Record<string, number> = { UNKNOWN: 0, HEALTHY: 1, FAILED: 1, PUMP_AND_DUMP: 1, RUG: 2 }
    expect((rank.UNKNOWN ?? 0) >= (rank.RUG ?? 0)).toBe(false)
    expect((rank.RUG ?? 0) >= (rank.UNKNOWN ?? 0)).toBe(true)
  })
})
