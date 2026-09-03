import type { HistoricalPoolTransaction } from './solana-pool-history'
import { PUMP_PROGRAM_ID, type PumpGraduationObservation } from './pump-bonding-curve-detector'

export const PUMP_SWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'

// Anchor discriminator for Pump::migrate from the published Pump IDL.
const PUMP_MIGRATE_DISCRIMINATOR = [155, 234, 231, 146, 236, 158, 162, 30]

// Published migrate account order:
// global, withdraw_authority, mint, bonding_curve, associated_bonding_curve,
// user, system_program, token_program, pump_amm, pool, ...
const MIGRATE_MINT_ACCOUNT_INDEX = 2
const MIGRATE_BONDING_CURVE_ACCOUNT_INDEX = 3
const MIGRATE_PUMP_AMM_ACCOUNT_INDEX = 8
const MIGRATE_POOL_ACCOUNT_INDEX = 9

type RawInstruction = {
  programId?: string
  program?: string
  programIdIndex?: number
  accounts?: Array<string | number | { pubkey?: string; publicKey?: string }>
  data?: string | number[]
}

const bytesEqual = (left: number[], right: number[]) =>
  left.length >= right.length && right.every((value, index) => left[index] === value)

function base58Decode(value: string): number[] | null {
  if (!value) return null
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const indexes = new Map([...alphabet].map((char, index) => [char, index]))
  const bytes = [0]

  for (const char of value) {
    const digit = indexes.get(char)
    if (digit === undefined) return null
    let carry = digit
    for (let index = 0; index < bytes.length; index += 1) {
      const next = bytes[index] * 58 + carry
      bytes[index] = next & 0xff
      carry = next >> 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (let index = 0; index < value.length && value[index] === '1'; index += 1) bytes.push(0)
  return bytes.reverse()
}

function instructionData(ix: RawInstruction): number[] | null {
  if (Array.isArray(ix.data)) return ix.data
  if (typeof ix.data === 'string') return base58Decode(ix.data)
  return null
}

function accountKeys(raw: any): string[] {
  const keys = raw?.transaction?.message?.accountKeys ?? raw?.message?.accountKeys ?? raw?.accountKeys
  if (!Array.isArray(keys)) return []
  return keys
    .map((key: any) => typeof key === 'string' ? key : key?.pubkey ?? key?.publicKey)
    .filter((value: any): value is string => typeof value === 'string')
}

function instructions(raw: any): RawInstruction[] {
  const outer = raw?.transaction?.message?.instructions ?? raw?.message?.instructions ?? raw?.instructions
  return Array.isArray(outer) ? outer : []
}

function programId(ix: RawInstruction, keys: string[]): string | undefined {
  if (typeof ix.programId === 'string') return ix.programId
  if (typeof ix.program === 'string') return ix.program
  if (typeof ix.programIdIndex === 'number') return keys[ix.programIdIndex]
  return undefined
}

function resolveAccount(value: string | number | { pubkey?: string; publicKey?: string }, keys: string[]): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return keys[value]
  return value.pubkey ?? value.publicKey
}

function migrateAccounts(ix: RawInstruction, keys: string[]): string[] | null {
  if (!Array.isArray(ix.accounts) || ix.accounts.length <= MIGRATE_POOL_ACCOUNT_INDEX) return null
  const resolved = ix.accounts.map(account => resolveAccount(account, keys))
  if (resolved.some(value => !value)) return null
  return resolved as string[]
}

function decodeMigrate(ix: RawInstruction, keys: string[], graduation: PumpGraduationObservation): string | null {
  if (programId(ix, keys) !== PUMP_PROGRAM_ID) return null

  const data = instructionData(ix)
  if (!data || !bytesEqual(data, PUMP_MIGRATE_DISCRIMINATOR)) return null

  const accounts = migrateAccounts(ix, keys)
  if (!accounts) return null

  const mint = accounts[MIGRATE_MINT_ACCOUNT_INDEX]
  const bondingCurve = accounts[MIGRATE_BONDING_CURVE_ACCOUNT_INDEX]
  const pumpAmm = accounts[MIGRATE_PUMP_AMM_ACCOUNT_INDEX]
  const pool = accounts[MIGRATE_POOL_ACCOUNT_INDEX]

  // Migration evidence is accepted only when the instruction's canonical
  // accounts agree with the graduated curve and identify PumpSwap directly.
  if (mint !== graduation.mint || bondingCurve !== graduation.bondingCurve) return null
  if (pumpAmm !== PUMP_SWAP_PROGRAM_ID || !pool) return null
  return pool
}

/**
 * Observes a Pump -> PumpSwap migration using the published Anchor migrate
 * discriminator and account layout. Completion alone remains insufficient.
 */
export function observePumpMigration(
  tx: HistoricalPoolTransaction,
  graduation: PumpGraduationObservation,
  config: { source?: string } = {},
): PumpMigrationObservation {
  const keys = accountKeys(tx.raw)
  const pool = instructions(tx.raw)
    .map(ix => decodeMigrate(ix, keys, graduation))
    .find((value): value is string => typeof value === 'string')

  const status = pool ? 'MIGRATION_OBSERVED' : 'COMPLETED_WAITING_FOR_MIGRATION'
  const evidenceIds = [...new Set([tx.evidenceId, ...graduation.evidenceIds])]

  return {
    observationId: `pump-migration:${graduation.mint}:${tx.signature}:${status}`,
    mint: graduation.mint,
    bondingCurve: graduation.bondingCurve,
    pumpSwapPool: pool,
    signature: tx.signature,
    observedAt: tx.observedAt,
    status,
    evidenceIds,
    provenance: {
      pumpProgramId: PUMP_PROGRAM_ID,
      pumpSwapProgramId: PUMP_SWAP_PROGRAM_ID,
      source: config.source ?? 'pump-migration-observer',
    },
    executionAllowed: false,
  }
}
