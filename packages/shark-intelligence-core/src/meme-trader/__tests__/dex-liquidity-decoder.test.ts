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

  function setU16(data: Uint8Array, offset: number, value: number): void {
    data[offset] = value & 0xff
    data[offset + 1] = (value >>> 8) & 0xff
  }

  function setU64(data: Uint8Array, offset: number, value: bigint): void {
    for (let i = 0; i < 8; i++) data[offset + i] = Number((value >> BigInt(i * 8)) & 0xffn)
  }

  function setI128(data: Uint8Array, offset: number, value: bigint): void {
    const encoded = value < 0n ? (1n << 128n) + value : value
    for (let i = 0; i < 16; i++) data[offset + i] = Number((encoded >> BigInt(i * 8)) & 0xffn)
  }

  it('decodes the current PumpSwap Pool layout', () => {
    const data = new Uint8Array(261)
    setU16(data, 9, 0)
    setKey(data, 11, 1)
    setKey(data, 43, 2)
    setKey(data, 75, 3)
    setKey(data, 107, 4)
    setKey(data, 139, 5)
    setKey(data, 171, 6)
    setU64(data, 203, 123_456n)
    setKey(data, 211, 7)
    data[243] = 1
    data[244] = 0
    setI128(data, 245, 987_654n)

    const parsed = parsePumpSwapPoolState({ data, owner: PUMPSWAP_AMM_PROGRAM_ID, poolAddress: 'pool-address' })

    expect(parsed.programId).toBe(PUMPSWAP_AMM_PROGRAM_ID)
    expect(parsed.poolAddress).toBe('pool-address')
    expect(parsed.index).toBe(0)
    expect(parsed.lpSupply).toBe(123_456n)
    expect(parsed.virtualQuoteReserves).toBe(987_654n)
    expect(parsed.isMayhemMode).toBe(true)
    expect(parsed.isCashbackCoin).toBe(false)
    expect(parsed.baseMint).toHaveLength(44)
    expect(parsed.quoteMint).toHaveLength(44)
    expect(parsed.lpMint).toHaveLength(44)
    expect(parsed.baseVault).toHaveLength(44)
    expect(parsed.quoteVault).toHaveLength(44)
    expect(parsed.coinCreator).toHaveLength(44)
  })

  it('decodes a negative PumpSwap virtual quote reserve as signed i128', () => {
    const data = new Uint8Array(261)
    setI128(data, 245, -123n)
    const parsed = parsePumpSwapPoolState({ data })
    expect(parsed.virtualQuoteReserves).toBe(-123n)
  })

  it('preserves non-canonical pool indexes for a higher-level validator', () => {
    const data = new Uint8Array(261)
    setU16(data, 9, 1)
    const parsed = parsePumpSwapPoolState({ data })
    expect(parsed.index).toBe(1)
    expect(parsed.index).not.toBe(0)
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
  })

  it('rejects a wrong program owner', () => {
    expect(() => parseRaydiumAmmV4PoolState({ data: new Uint8Array(752), owner: PUMPSWAP_AMM_PROGRAM_ID })).toThrow('owner mismatch')
    expect(() => parsePumpSwapPoolState({ data: new Uint8Array(261), owner: RAYDIUM_AMM_V4_PROGRAM_ID })).toThrow('owner mismatch')
  })

  it('rejects truncated pool state', () => {
    expect(() => parseRaydiumAmmV4PoolState({ data: new Uint8Array(751) })).toThrow('invalid raydium liquidity-v4 pool data length')
    expect(() => parsePumpSwapPoolState({ data: new Uint8Array(260) })).toThrow('invalid pumpswap pool data length')
  })

  it('accepts base64 account data', () => {
    const bytes = new Uint8Array(261)
    setKey(bytes, 43, 9)
    const base64 = Buffer.from(bytes).toString('base64')
    const parsed = parsePumpSwapPoolState({ data: base64 })
    expect(parsed.baseMint).toHaveLength(44)
  })
})
