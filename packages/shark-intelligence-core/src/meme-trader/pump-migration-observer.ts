import type { HistoricalPoolTransaction } from './solana-pool-history'
import { PUMP_PROGRAM_ID, type PumpGraduationObservation } from './pump-bonding-curve-detector'

export const PUMP_SWAP_PROGRAM_ID = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'

export type PumpMigrationObservation = {
  observationId: string
  mint: string
  bondingCurve: string
  pumpSwapPool?: string
  signature: string
  observedAt: string
  slot?: number
  status: 'MIGRATION_OBSERVED' | 'COMPLETED_WAITING_FOR_MIGRATION'
  evidenceIds: string[]
  provenance: { pumpProgramId: string; pumpSwapProgramId: string; source: string }
  executionAllowed: false
}

type RawInstruction = {
  programId?: string
  program?: string
  programIdIndex?: number
  accounts?: string[]
  data?: string | number[]
}

const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []

function accountKeys(raw: any): string[] {
  const keys = raw?.transaction?.message?.accountKeys ?? raw?.message?.accountKeys ?? raw?.accountKeys
  if (!Array.isArray(keys)) return []
  return keys.map((key: any) => typeof key === 'string' ? key : key?.pubkey ?? key?.publicKey).filter((v: any): v is string => typeof v === 'string')
}

function instructions(raw: any): RawInstruction[] {
  const outer = raw?.transaction?.message?.instructions ?? raw?.message?.instructions ?? raw?.instructions
  const inner = Array.isArray(raw?.meta?.innerInstructions) ? raw.meta.innerInstructions.flatMap((x: any) => Array.isArray(x?.instructions) ? x.instructions : []) : []
  return [...(Array.isArray(outer) ? outer : []), ...inner]
}

function programId(ix: RawInstruction, keys: string[]): string | undefined {
  if (typeof ix.programId === 'string') return ix.programId
  if (typeof ix.program === 'string') return ix.program
  if (typeof ix.programIdIndex === 'number') return keys[ix.programIdIndex]
  return undefined
}

function instructionMentionsMigration(ix: RawInstruction, keys: string[]): boolean {
  const data = typeof ix.data === 'string' ? ix.data.toLowerCase() : ''
  const accounts = strings(ix.accounts).join(':')
  // Account-level recognition is intentionally conservative. We require the Pump
  // program and a migration-shaped instruction marker; the pool is taken only from
  // explicit account data, never guessed from arbitrary token transfers.
  return data.includes('migrate') || accounts.toLowerCase().includes('migrate')
}

/**
 * Observes a Pump -> PumpSwap migration. Completion alone is NOT treated as
 * migration: Pump's public docs define migrate as the separate transition and
 * the migration window can exist between complete=true and the AMM pool being
 * observable.
 */
export function observePumpMigration(
  tx: HistoricalPoolTransaction,
  graduation: PumpGraduationObservation,
  config: { source?: string } = {},
): PumpMigrationObservation {
  const keys = accountKeys(tx.raw)
  const pumpPrograms = new Set([PUMP_PROGRAM_ID])
  const pumpSwapPrograms = new Set([PUMP_SWAP_PROGRAM_ID])
  const ix = instructions(tx.raw)
  const pumpMigration = ix.some(item => pumpPrograms.has(programId(item, keys) ?? '') && instructionMentionsMigration(item, keys))
  const pumpSwapMentioned = ix.some(item => pumpSwapPrograms.has(programId(item, keys) ?? ''))

  const status = pumpMigration && pumpSwapMentioned ? 'MIGRATION_OBSERVED' : 'COMPLETED_WAITING_FOR_MIGRATION'
  const evidenceIds = [...new Set([tx.evidenceId, ...graduation.evidenceIds])]

  return {
    observationId: `pump-migration:${graduation.mint}:${tx.signature}:${status}`,
    mint: graduation.mint,
    bondingCurve: graduation.bondingCurve,
    signature: tx.signature,
    observedAt: tx.observedAt,
    status,
    evidenceIds,
    provenance: { pumpProgramId: PUMP_PROGRAM_ID, pumpSwapProgramId: PUMP_SWAP_PROGRAM_ID, source: config.source ?? 'pump-migration-observer' },
    executionAllowed: false,
  }
}
