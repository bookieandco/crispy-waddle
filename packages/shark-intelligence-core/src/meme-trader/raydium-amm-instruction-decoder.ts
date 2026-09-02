import type { HistoricalPoolTransaction, PoolHistory } from './solana-pool-history'
import type { LiquidityEventEvidence, LiquidityInstructionDecoder } from './liquidity-event-semantics'

export const RAYDIUM_AMM_V4_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'

/** Raydium AMM V4 legacy instruction tags. Verified against raydium-amm/program/src/instruction.rs. */
export const RAYDIUM_AMM_INSTRUCTION = {
  INITIALIZE2: 1,
  DEPOSIT: 3,
  WITHDRAW: 4,
  SWAP_BASE_IN: 9,
  SWAP_BASE_OUT: 11,
} as const

const SPL_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const SPL_TOKEN_BURN_TAG = 8

type Instruction = {
  programId?: unknown
  programIdIndex?: unknown
  accounts?: unknown
  data?: unknown
}

type InnerInstructionGroup = { instructions?: unknown }

type AccountKeys = Array<string | { pubkey?: string }>

function accountKey(keys: AccountKeys, index: number): string | undefined {
  const key = keys[index]
  return typeof key === 'string' ? key : key?.pubkey
}

function accountKeys(raw: Record<string, unknown>): AccountKeys {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  const keys = message?.accountKeys ?? tx.accountKeys ?? raw.accountKeys
  return Array.isArray(keys) ? keys.filter((key): key is string | { pubkey?: string } => typeof key === 'string' || !!key && typeof key === 'object') : []
}

function instructions(raw: unknown): Instruction[] {
  if (!raw || typeof raw !== 'object') return []
  const row = raw as Record<string, unknown>
  const tx = row.transaction && typeof row.transaction === 'object' ? row.transaction as Record<string, unknown> : row
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  return Array.isArray(message?.instructions) ? message.instructions as Instruction[] : []
}

function innerInstructions(raw: unknown): Instruction[] {
  if (!raw || typeof raw !== 'object') return []
  const row = raw as Record<string, unknown>
  const meta = row.meta && typeof row.meta === 'object' ? row.meta as Record<string, unknown> : undefined
  const groups = Array.isArray(meta?.innerInstructions) ? meta.innerInstructions as InnerInstructionGroup[] : []
  return groups.flatMap(group => Array.isArray(group.instructions) ? group.instructions as Instruction[] : [])
}

function programId(ix: Instruction, keys: AccountKeys): string | undefined {
  if (typeof ix.programId === 'string') return ix.programId
  if (typeof ix.programIdIndex === 'number' && Number.isInteger(ix.programIdIndex)) return accountKey(keys, ix.programIdIndex)
  return undefined
}

function rawData(data: unknown): Uint8Array | undefined {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data) && data.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return Uint8Array.from(data)
  if (typeof data !== 'string') return undefined
  try {
    const binary = atob(data)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
  } catch {
    try {
      const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
      let value = 0n
      for (const char of data) {
        const digit = alphabet.indexOf(char)
        if (digit < 0) return undefined
        value = value * 58n + BigInt(digit)
      }
      const bytes: number[] = []
      while (value > 0n) { bytes.unshift(Number(value & 255n)); value >>= 8n }
      for (const char of data) if (char === '1') bytes.unshift(0); else break
      return Uint8Array.from(bytes)
    } catch { return undefined }
  }
}

function readU64LE(data: Uint8Array, offset = 1): bigint | undefined {
  if (data.length < offset + 8) return undefined
  let value = 0n
  for (let i = 0; i < 8; i++) value |= BigInt(data[offset + i]) << BigInt(i * 8)
  return value
}

function makeEvent(input: {
  transaction: HistoricalPoolTransaction
  pool: PoolHistory['pool']
  kind: LiquidityEventEvidence['kind']
  actorId?: string
  lpMint?: string
  amountRaw?: bigint
  source: string
  semantic?: LiquidityEventEvidence['semantic']
}): LiquidityEventEvidence {
  return {
    eventId: `raydium:${input.transaction.signature}:${input.kind}:${input.lpMint ?? 'none'}`,
    kind: input.kind,
    observedAt: input.transaction.observedAt,
    poolAddress: input.pool.poolAddress,
    actorId: input.actorId,
    lpMint: input.lpMint,
    amountRaw: input.amountRaw,
    source: input.source,
    evidenceIds: [input.transaction.evidenceId],
    confidence: 1,
    semantic: input.semantic ?? 'EXPLICIT',
  }
}

/**
 * Decodes Raydium AMM V4 legacy instructions. This is intentionally limited
 * to semantic identification; reserve valuation remains in the reserve layer.
 */
export class RaydiumAmmInstructionDecoder implements LiquidityInstructionDecoder {
  decode(transaction: HistoricalPoolTransaction, pool: PoolHistory['pool']): LiquidityEventEvidence[] {
    if (!transaction.raw || typeof transaction.raw !== 'object') return []
    const raw = transaction.raw as Record<string, unknown>
    const keys = accountKeys(raw)
    const events: LiquidityEventEvidence[] = []

    for (const ix of instructions(raw)) {
      if (programId(ix, keys) !== RAYDIUM_AMM_V4_PROGRAM_ID) continue
      const accounts = Array.isArray(ix.accounts) ? ix.accounts.filter((a): a is number => typeof a === 'number' && Number.isInteger(a)) : []
      const data = rawData(ix.data)
      if (!data?.length) continue
      const tag = data[0]

      if (tag === RAYDIUM_AMM_INSTRUCTION.DEPOSIT) {
        const lpMint = accountKey(keys, accounts[5])
        const actor = accountKey(keys, accounts[12])
        events.push(makeEvent({ transaction, pool, kind: 'LIQUIDITY_ADD', actorId: actor, lpMint, amountRaw: readU64LE(data), source: 'raydium-amm:deposit' }))
        continue
      }

      if (tag === RAYDIUM_AMM_INSTRUCTION.WITHDRAW) {
        const lpMint = accountKey(keys, accounts[5])
        const actor = accountKey(keys, accounts[16])
        events.push(makeEvent({ transaction, pool, kind: 'LIQUIDITY_REMOVE', actorId: actor, lpMint, amountRaw: readU64LE(data), source: 'raydium-amm:withdraw' }))
        continue
      }

      if (tag === RAYDIUM_AMM_INSTRUCTION.SWAP_BASE_IN || tag === RAYDIUM_AMM_INSTRUCTION.SWAP_BASE_OUT) {
        const actor = accountKey(keys, accounts[17])
        events.push(makeEvent({ transaction, pool, kind: 'SWAP', actorId: actor, source: `raydium-amm:swap-${tag === 9 ? 'base-in' : 'base-out'}` }))
        continue
      }

      if (tag === RAYDIUM_AMM_INSTRUCTION.INITIALIZE2) {
        const lpMint = accountKey(keys, accounts[7])
        const actor = accountKey(keys, accounts[17])
        events.push(makeEvent({ transaction, pool, kind: 'POOL_CREATE', actorId: actor, lpMint, source: 'raydium-amm:initialize2' }))
      }
    }

    // The Raydium Withdraw instruction is the authoritative semantic signal.
    // A nested SPL Burn corroborates that LP supply was actually consumed.
    for (const ix of innerInstructions(raw)) {
      if (programId(ix, keys) !== SPL_TOKEN_PROGRAM_ID) continue
      const data = rawData(ix.data)
      if (!data?.length || data[0] !== SPL_TOKEN_BURN_TAG) continue
      const accounts = Array.isArray(ix.accounts) ? ix.accounts.filter((a): a is number => typeof a === 'number' && Number.isInteger(a)) : []
      const amount = readU64LE(data)
      const lpMint = accountKey(keys, accounts[1])
      const owner = accountKey(keys, accounts[2])
      events.push(makeEvent({ transaction, pool, kind: 'LP_BURN', actorId: owner, lpMint, amountRaw: amount, source: 'spl-token:burn' }))
    }

    return events
  }
}
