import type { HistoricalPoolTransaction } from './solana-pool-history'
import type { DlmmPositionTransition } from './meteora-dlmm-position-state'

export const METEORA_DLMM_PROGRAM_ID = 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'

type Instruction = { programId?: unknown; programIdIndex?: unknown; accounts?: unknown; data?: unknown }
type AccountKey = string | { pubkey?: string }

export type MeteoraDlmmDecoderContext = { poolAddress?: string; tokenMint?: string }

const DISC = {
  ADD: [181,157,89,67,143,182,52,72],
  ADD_WEIGHT: [28,140,238,99,231,162,21,149],
  ADD_STRATEGY: [7,3,150,127,148,40,61,200],
  ADD_STRATEGY_ONE_SIDE: [41,5,238,175,100,225,6,205],
  ADD_ONE_SIDE: [94,155,103,151,70,95,220,165],
  REMOVE: [80,85,209,72,24,206,177,108],
  REMOVE_V2: [230,215,82,127,241,101,227,146],
  REMOVE_RANGE: [26,82,102,152,240,74,105,26],
  REMOVE_RANGE_V2: [204,2,195,145,53,145,145,205],
  INIT_POSITION: [219,192,234,71,190,191,102,80],
  INIT_POSITION_PDA: [46,82,125,146,85,141,228,153],
  INIT_POSITION_OPERATOR: [251,189,190,244,117,254,35,148],
  CLOSE: [123,134,81,0,49,68,98,98],
  CLOSE_V2: [174,90,35,115,186,40,147,226],
  CLOSE_EMPTY: [59,124,212,118,91,152,110,157],
  REBALANCE: [92,4,176,193,119,185,83,9],
  CLAIM_FEE: [169,32,79,137,136,232,70,137],
} as const

const EVENTS = {
  ADD: [31,94,125,90,227,52,61,186],
  REMOVE: [116,244,97,232,103,31,152,58],
  POSITION_CREATE: [144,142,252,84,157,53,37,121],
  POSITION_CLOSE: [255,196,16,107,28,202,53,128],
  REBALANCE: [0,109,117,179,61,0,0,0],
  CLAIM_FEE: [75,122,154,48,140,74,123,163],
} as const

function samePrefix(data: Uint8Array, prefix: readonly number[]) {
  return data.length >= prefix.length && prefix.every((v, i) => data[i] === v)
}

function accountKeys(raw: Record<string, unknown>): AccountKey[] {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  const keys = message?.accountKeys ?? tx.accountKeys ?? raw.accountKeys
  return Array.isArray(keys) ? keys.filter((x): x is AccountKey => typeof x === 'string' || !!x && typeof x === 'object') : []
}

function keyAt(keys: AccountKey[], index: unknown): string | undefined {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return undefined
  const key = keys[index]
  return typeof key === 'string' ? key : key?.pubkey
}

function programId(ix: Instruction, keys: AccountKey[]): string | undefined {
  if (typeof ix.programId === 'string') return ix.programId
  return keyAt(keys, ix.programIdIndex)
}

function instructions(raw: Record<string, unknown>): Instruction[] {
  const tx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : raw
  const message = tx.message && typeof tx.message === 'object' ? tx.message as Record<string, unknown> : undefined
  return Array.isArray(message?.instructions) ? message.instructions as Instruction[] : []
}

function logs(raw: Record<string, unknown>): string[] {
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta as Record<string, unknown> : undefined
  const nestedTx = raw.transaction && typeof raw.transaction === 'object' ? raw.transaction as Record<string, unknown> : undefined
  const nestedMeta = nestedTx?.meta && typeof nestedTx.meta === 'object' ? nestedTx.meta as Record<string, unknown> : undefined
  const value = meta?.logMessages ?? nestedMeta?.logMessages
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

function bytes(data: unknown): Uint8Array | undefined {
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data) && data.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return Uint8Array.from(data)
  if (typeof data !== 'string') return undefined
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let value = 0n
  for (const c of data) { const d = alphabet.indexOf(c); if (d < 0) return undefined; value = value * 58n + BigInt(d) }
  const out: number[] = []
  while (value > 0n) { out.unshift(Number(value & 255n)); value >>= 8n }
  for (const c of data) if (c === '1') out.unshift(0); else break
  return Uint8Array.from(out)
}

function base64Bytes(value: string): Uint8Array | undefined {
  try {
    if (typeof globalThis.atob !== 'function') return undefined
    const raw = globalThis.atob(value)
    return Uint8Array.from(raw, c => c.charCodeAt(0))
  } catch { return undefined }
}

function u16(data: Uint8Array, o: number): number | undefined { return data.length >= o + 2 ? data[o] | (data[o+1] << 8) : undefined }
function i32(data: Uint8Array, o: number): number | undefined {
  if (data.length < o + 4) return undefined
  return (data[o] | data[o+1] << 8 | data[o+2] << 16 | data[o+3] << 24) >> 0
}
function u64(data: Uint8Array, o: number): bigint | undefined {
  if (data.length < o + 8) return undefined
  let n = 0n
  for (let i=0;i<8;i++) n |= BigInt(data[o+i]) << BigInt(i*8)
  return n
}
function pubkey(data: Uint8Array, o: number): string | undefined {
  if (data.length < o + 32) return undefined
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (let i=0;i<32;i++) n = (n << 8n) + BigInt(data[o+i])
  let out = ''
  while (n > 0n) { const r = Number(n % 58n); out = alphabet[r] + out; n /= 58n }
  for (let i=0;i<32 && data[i] === 0;i++) out = '1' + out
  return out || '1'
}

function transition(base: Omit<DlmmPositionTransition,'eventId'>, suffix: string): DlmmPositionTransition {
  return { ...base, eventId: `meteora-dlmm:${base.signature}:${suffix}` }
}

export class MeteoraDlmmPositionInstructionDecoder {
  constructor(private readonly context: MeteoraDlmmDecoderContext = {}) {}

  decode(transaction: HistoricalPoolTransaction): DlmmPositionTransition[] {
    if (!transaction.raw || typeof transaction.raw !== 'object') return []
    const raw = transaction.raw as Record<string, unknown>
    const keys = accountKeys(raw)
    const out: DlmmPositionTransition[] = []
    const push = (value: Omit<DlmmPositionTransition,'eventId'>, suffix: string) => out.push(transition(value, suffix))

    for (const ix of instructions(raw)) {
      if (programId(ix, keys) !== METEORA_DLMM_PROGRAM_ID) continue
      const a = Array.isArray(ix.accounts) ? ix.accounts : []
      const data = bytes(ix.data)
      if (!data || data.length < 8) continue
      const common = { signature: transaction.signature, observedAt: transaction.observedAt, poolAddress: this.context.poolAddress ?? keyAt(keys, a[1]) ?? '', tokenMint: this.context.tokenMint, evidenceIds: [transaction.evidenceId], confidence: 1, semantic: 'EXPLICIT' as const }
      if (samePrefix(data, DISC.INIT_POSITION) || samePrefix(data, DISC.INIT_POSITION_PDA)) {
        const lower = i32(data, 8); const width = i32(data, 12)
        const position = keyAt(keys, a[samePrefix(data, DISC.INIT_POSITION) ? 1 : 2]); const owner = keyAt(keys, a[samePrefix(data, DISC.INIT_POSITION) ? 3 : 4]); const pool = keyAt(keys, a[samePrefix(data, DISC.INIT_POSITION) ? 2 : 3])
        if (position && pool && lower !== undefined && width !== undefined && width >= 0) push({ ...common, positionAddress: position, poolAddress: pool, owner, fromBinId: lower, toBinId: lower + width, action: 'OPEN' }, 'open:'+position)
      } else if (samePrefix(data, DISC.INIT_POSITION_OPERATOR)) {
        const lower = i32(data, 8); const width = i32(data, 12); const position = keyAt(keys, a[2]); const pool = keyAt(keys, a[3]); const owner = keyAt(keys, a[4]); const operator = keyAt(keys, a[5])
        if (position && pool && lower !== undefined && width !== undefined && width >= 0) push({ ...common, positionAddress: position, poolAddress: pool, owner, operator, fromBinId: lower, toBinId: lower + width, action: 'OPEN' }, 'open-operator:'+position)
      } else if (samePrefix(data, DISC.CLOSE) || samePrefix(data, DISC.CLOSE_V2) || samePrefix(data, DISC.CLOSE_EMPTY)) {
        const position = keyAt(keys, a[0]); const owner = keyAt(keys, a[1]); const pool = keyAt(keys, a[1])
        if (position) push({ ...common, positionAddress: position, poolAddress: this.context.poolAddress ?? pool ?? '', owner, action: 'CLOSE' }, 'close:'+position)
      } else if (samePrefix(data, DISC.REMOVE_RANGE) || samePrefix(data, DISC.REMOVE_RANGE_V2)) {
        const position = keyAt(keys, a[0]); const pool = keyAt(keys, a[1]); const sender = keyAt(keys, a[11] ?? a[9]); const from = i32(data, 8); const to = i32(data, 12); const bps = u16(data, 16)
        if (position && pool && from !== undefined && to !== undefined && bps !== undefined) push({ ...common, positionAddress: position, poolAddress: pool, owner: sender, fromBinId: from, toBinId: to, removedBps: bps, action: 'REMOVE' }, 'remove-range:'+position+':'+from+':'+to)
      } else if (samePrefix(data, DISC.REMOVE) || samePrefix(data, DISC.REMOVE_V2)) {
        const position = keyAt(keys, a[0]); const pool = keyAt(keys, a[1]); const sender = keyAt(keys, a[11] ?? a[9])
        if (position && pool) push({ ...common, positionAddress: position, poolAddress: pool, owner: sender, action: 'REMOVE' }, 'remove:'+position)
      } else if (samePrefix(data, DISC.REBALANCE)) {
        const position = keyAt(keys, a[0]); const pool = keyAt(keys, a[1]); const owner = keyAt(keys, a[9] ?? a[8]); const active = i32(data, 8)
        if (position && pool) push({ ...common, positionAddress: position, poolAddress: pool, owner, activeBinId: active, action: 'REBALANCE' }, 'rebalance:'+position)
      } else if (samePrefix(data, DISC.CLAIM_FEE)) {
        const position = keyAt(keys, a[1] ?? a[0]); const pool = keyAt(keys, a[0] ?? a[1]); const owner = keyAt(keys, a[2] ?? a[1])
        if (position && pool) push({ ...common, positionAddress: position, poolAddress: pool, owner, action: 'CLAIM_FEE' }, 'claim-fee:'+position)
      } else if (samePrefix(data, DISC.ADD) || samePrefix(data, DISC.ADD_WEIGHT) || samePrefix(data, DISC.ADD_STRATEGY) || samePrefix(data, DISC.ADD_STRATEGY_ONE_SIDE) || samePrefix(data, DISC.ADD_ONE_SIDE)) {
        const position = keyAt(keys, a[0]); const pool = keyAt(keys, a[1]); const sender = keyAt(keys, a[11] ?? a[8]); if (position && pool) push({ ...common, positionAddress: position, poolAddress: pool, owner: sender, action: 'ADD' }, 'add:'+position)
      }
    }

    for (const line of logs(raw)) {
      const marker = line.match(/Program data:\s*([A-Za-z0-9+/=]+)$/)?.[1]
      if (!marker) continue
      const data = base64Bytes(marker); if (!data || data.length < 8) continue
      if (samePrefix(data, EVENTS.POSITION_CREATE)) {
        const lb = pubkey(data,8); const position = pubkey(data,40); const owner = pubkey(data,72)
        if (lb && position && owner && (!this.context.poolAddress || lb === this.context.poolAddress)) push({ signature: transaction.signature, observedAt: transaction.observedAt, poolAddress: lb, tokenMint: this.context.tokenMint, positionAddress: position, owner, action:'OPEN', evidenceIds:[transaction.evidenceId], confidence:1, semantic:'EXPLICIT' }, 'event-open:'+position)
      } else if (samePrefix(data, EVENTS.POSITION_CLOSE)) {
        const position = pubkey(data,8); const owner = pubkey(data,40)
        if (position && owner) push({ signature: transaction.signature, observedAt: transaction.observedAt, poolAddress: this.context.poolAddress ?? '', tokenMint:this.context.tokenMint, positionAddress:position, owner, action:'CLOSE', evidenceIds:[transaction.evidenceId], confidence:1, semantic:'EXPLICIT' }, 'event-close:'+position)
      } else if (samePrefix(data, EVENTS.ADD) || samePrefix(data, EVENTS.REMOVE)) {
        const lb = pubkey(data,8); const from = pubkey(data,40); const position = pubkey(data,72); const x = u64(data,104); const y = u64(data,112); const active = i32(data,120)
        if (!lb || !position || x === undefined || y === undefined || (!this.context.poolAddress || lb === this.context.poolAddress)) continue
        const action = samePrefix(data, EVENTS.ADD) ? 'ADD' : 'REMOVE'
        push({ signature:transaction.signature, observedAt:transaction.observedAt, poolAddress:lb, tokenMint:this.context.tokenMint, positionAddress:position, owner:from, action, activeBinId:active, tokenXDeltas:x, tokenYDeltas:y, oneSided:(x===0n)!==(y===0n), evidenceIds:[transaction.evidenceId], confidence:1, semantic:'EXPLICIT' }, `${action.toLowerCase()}-event:${position}`)
      } else if (samePrefix(data, EVENTS.REBALANCE)) {
        const lb = pubkey(data,8); const position = pubkey(data,40); const owner = pubkey(data,72); const active = i32(data,104); const xw=u64(data,108); const xa=u64(data,116); const yw=u64(data,124); const ya=u64(data,132); const oldMin=i32(data,156); const oldMax=i32(data,160); const newMin=i32(data,164); const newMax=i32(data,168)
        if (lb && position && owner && active !== undefined && xw !== undefined && xa !== undefined && yw !== undefined && ya !== undefined && oldMin !== undefined && oldMax !== undefined && newMin !== undefined && newMax !== undefined && (!this.context.poolAddress || lb === this.context.poolAddress)) push({ signature:transaction.signature, observedAt:transaction.observedAt, poolAddress:lb, tokenMint:this.context.tokenMint, positionAddress:position, owner, action:'REBALANCE', activeBinId:active, fromBinId:newMin, toBinId:newMax, evidenceIds:[transaction.evidenceId], confidence:1, semantic:'EXPLICIT' }, 'rebalance-event:'+position)
      }
    }
    return out
  }
}
