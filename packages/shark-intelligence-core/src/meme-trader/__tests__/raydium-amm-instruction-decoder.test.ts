import { describe, expect, it } from 'vitest'
import { RaydiumAmmInstructionDecoder, RAYDIUM_AMM_V4_PROGRAM_ID } from '../raydium-amm-instruction-decoder'

const key = (n: number) => `KEY_${n}`
const pool = { poolAddress: key(1), baseMint: key(2), quoteMint: key(3) }
const transaction = (instructions: unknown[], innerInstructions: unknown[] = []) => ({
  signature: 'sig-1',
  observedAt: '2026-09-02T12:00:00.000Z',
  accountAddress: pool.poolAddress,
  evidenceId: 'ev-1',
  raw: {
    transaction: { message: { accountKeys: Array.from({ length: 30 }, (_, i) => key(i)), instructions } },
    meta: { innerInstructions: [{ instructions: innerInstructions }] },
  },
})

function base58(bytes: number[]): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let value = 0n
  for (const byte of bytes) value = value * 256n + BigInt(byte)
  let result = ''
  while (value > 0n) { const digit = Number(value % 58n); result = alphabet[digit] + result; value /= 58n }
  for (const byte of bytes) if (byte === 0) result = '1' + result; else break
  return result || '1'
}

function u64(value: bigint): number[] {
  const bytes: number[] = []
  for (let i = 0; i < 8; i++) bytes.push(Number((value >> BigInt(i * 8)) & 255n))
  return bytes
}

const ix = (tag: number, accounts: number[], amount?: bigint) => ({
  programId: RAYDIUM_AMM_V4_PROGRAM_ID,
  accounts,
  data: base58([tag, ...(amount === undefined ? [] : u64(amount))]),
})

const splBurn = (amount: bigint) => ({
  programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  accounts: [13, 5, 16],
  data: base58([8, ...u64(amount)]),
})

describe('RaydiumAmmInstructionDecoder', () => {
  const decoder = new RaydiumAmmInstructionDecoder()

  it('distinguishes an explicit Raydium withdrawal from a swap', () => {
    const tx = transaction([
      ix(4, Array.from({ length: 17 }, (_, i) => i), 2500n),
      ix(9, Array.from({ length: 18 }, (_, i) => i)),
    ])
    const events = decoder.decode(tx, pool as never)
    expect(events.map(e => e.kind)).toEqual(['LIQUIDITY_REMOVE', 'SWAP'])
    expect(events[0].actorId).toBe(key(16))
    expect(events[0].lpMint).toBe(key(5))
    expect(events[0].amountRaw).toBe(2500n)
    expect(events[1].actorId).toBe(key(17))
  })

  it('detects nested LP burn as corroborating evidence', () => {
    const tx = transaction([ix(4, Array.from({ length: 17 }, (_, i) => i), 900n)], [splBurn(900n)])
    const events = decoder.decode(tx, pool as never)
    expect(events.map(e => e.kind)).toEqual(['LIQUIDITY_REMOVE', 'LP_BURN'])
    expect(events[1].actorId).toBe(key(16))
    expect(events[1].lpMint).toBe(key(5))
    expect(events[1].amountRaw).toBe(900n)
  })

  it('does not classify arbitrary non-Ray​​dium instructions', () => {
    const tx = transaction([{ programId: 'SomeOtherProgram', accounts: [0], data: base58([4, ...u64(100n)]) }])
    expect(decoder.decode(tx, pool as never)).toEqual([])
  })
})
