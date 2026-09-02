import {
  PUMPSWAP_AMM_PROGRAM_ID,
  RAYDIUM_AMM_V4_PROGRAM_ID,
  parsePumpSwapPoolState,
  parseRaydiumAmmV4PoolState,
} from '../dex-liquidity-decoder'

describe('DEX pool-state decoders', () => {
  function setKey(data: Uint8Array, offset: number, value: number): void {
    data.fill(value, offset, offset + 32)
  }

  it('decodes PumpSwap verified offsets and owner', () => {
    const data = new Uint8Array(243)
    setKey(data, 43, 1)
    setKey(data, 75, 2)
    setKey(data, 139, 3)
    setKey(data, 171, 4)

    const parsed = parsePumpSwapPoolState({ data, owner: PUMPSWAP_AMM_PROGRAM_ID })

    expect(parsed.programId).toBe(PUMPSWAP_AMM_PROGRAM_ID)
    expect(parsed.baseMint).toHaveLength(44)
    expect(parsed.quoteMint).toHaveLength(44)
    expect(parsed.baseVault).toHaveLength(44)
    expect(parsed.quoteVault).toHaveLength(44)
    expect(parsed.baseMint).not.toBe(parsed.quoteMint)
  })

  it('decodes Raydium AMM V4 verified offsets', () => {
    const data = new Uint8Array(752)
    setKey(data, 400, 5)
    setKey(data, 432, 6)
    setKey(data, 336, 7)
    setKey(data, 368, 8)

    const parsed = parseRaydiumAmmV4PoolState({ data, owner: RAYDIUM_AMM_V4_PROGRAM_ID })

    expect(parsed.programId).toBe(RAYDIUM_AMM_V4_PROGRAM_ID)
    expect(parsed.baseMint).toHaveLength(44)
    expect(parsed.quoteMint).toHaveLength(44)
    expect(parsed.baseVault).toHaveLength(44)
    expect(parsed.quoteVault).toHaveLength(44)
    expect(parsed.baseMint).not.toBe(parsed.quoteMint)
  })

  it('rejects a wrong program owner', () => {
    expect(() => parseRaydiumAmmV4PoolState({ data: new Uint8Array(752), owner: PUMPSWAP_AMM_PROGRAM_ID })).toThrow('owner mismatch')
    expect(() => parsePumpSwapPoolState({ data: new Uint8Array(243), owner: RAYDIUM_AMM_V4_PROGRAM_ID })).toThrow('owner mismatch')
  })

  it('rejects truncated pool state', () => {
    expect(() => parseRaydiumAmmV4PoolState({ data: new Uint8Array(751) })).toThrow('invalid raydium liquidity-v4 pool data length')
    expect(() => parsePumpSwapPoolState({ data: new Uint8Array(242) })).toThrow('invalid pumpswap pool data length')
  })

  it('accepts base64 account data', () => {
    const bytes = new Uint8Array(752)
    setKey(bytes, 400, 9)
    const base64 = Buffer.from(bytes).toString('base64')
    const parsed = parseRaydiumAmmV4PoolState({ data: base64 })
    expect(parsed.baseMint).toHaveLength(44)
  })
})
