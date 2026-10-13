import { createHmac, timingSafeEqual } from 'node:crypto'
import { constants } from 'node:fs'
import { open, stat, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { phantomNativeSolToResearchEvidence, type PhantomAgentVerifiedNativeSol } from './phantom-agent-chain-verification.js'

/**
 * Local owner-host **tamper-evident** append-only forward observations.
 *
 * HMAC detects edits only while its key remains secret; it cannot prevent an
 * administrator with both the file and key from rewriting history. Periodic
 * independent, encrypted off-host checkpoints/restore tests remain mandatory.
 * This file NEVER stores account secrets or creates execution authority.
 */
export type PhantomStudyReceipt = Readonly<{
  sequence: number
  previousDigest: string
  walletId: string
  address: string
  balanceLamports: string
  slot: number
  observedAt: string
  writtenAt: string
  chainEvidenceHash: string
  phantomEvidenceHash: string
  authority: 'SHADOW_RESEARCH_ONLY'
  canExecute: false
  digest: string
}>
export type PhantomStudyStoreOptions = Readonly<{
  path: string
  hmacKey: string
  expectedWalletId: string
  expectedAddress: string
}>
const ZERO = '0'.repeat(64)
const HASH = /^[0-9a-f]{64}$/
const MAX_BYTES = 16 * 1024 * 1024
const MAX_ROWS = 10000
const SAFE_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
type ReceiptBody = Omit<PhantomStudyReceipt, 'digest'>

function validateOptions(options: PhantomStudyStoreOptions) {
  if (!isAbsolute(options.path) || options.path.endsWith('/') ||
      options.hmacKey.length < 32 || !options.expectedWalletId ||
      !SAFE_ADDRESS.test(options.expectedAddress)) {
    throw new Error('PHANTOM_STUDY_CONFIG_INVALID')
  }
}
function digest(body: ReceiptBody, key: string) {
  return createHmac('sha256', key).update(JSON.stringify(body)).digest('hex')
}
function verifyReceipt(row: PhantomStudyReceipt, previous: PhantomStudyReceipt | undefined, options: PhantomStudyStoreOptions) {
  const { digest: actual, ...body } = row
  if (row.walletId !== options.expectedWalletId || row.address !== options.expectedAddress ||
      !Number.isSafeInteger(row.sequence) || row.sequence !== (previous?.sequence ?? 0) + 1 ||
      row.previousDigest !== (previous?.digest ?? ZERO) ||
      !Number.isSafeInteger(row.slot) || row.slot <= 0 ||
      !/^\d+$/.test(row.balanceLamports) ||
      !HASH.test(row.chainEvidenceHash) || !HASH.test(row.phantomEvidenceHash) ||
      row.authority !== 'SHADOW_RESEARCH_ONLY' || row.canExecute !== false ||
      !Number.isFinite(Date.parse(row.observedAt)) ||
      !Number.isFinite(Date.parse(row.writtenAt)) ||
      (previous !== undefined &&
        (row.slot < previous.slot || Date.parse(row.writtenAt) < Date.parse(previous.writtenAt))) ||
      !HASH.test(actual)) {
    throw new Error('PHANTOM_STUDY_CHAIN_INVALID')
  }
  const expected = digest(body, options.hmacKey)
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))) {
    throw new Error('PHANTOM_STUDY_HMAC_MISMATCH')
  }
}
function parseLedger(data: string, options: PhantomStudyStoreOptions): PhantomStudyReceipt[] {
  if (!data) return []
  if (!data.endsWith('\n')) throw new Error('PHANTOM_STUDY_TRUNCATED')
  const lines = data.trimEnd().split('\n')
  if (lines.length > MAX_ROWS) throw new Error('PHANTOM_STUDY_LIMIT_REACHED')
  const receipts: PhantomStudyReceipt[] = []
  for (const line of lines) {
    let row: PhantomStudyReceipt
    try { row = JSON.parse(line) as PhantomStudyReceipt } catch {
      throw new Error('PHANTOM_STUDY_INVALID_JSON')
    }
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('PHANTOM_STUDY_INVALID_ROW')
    }
    verifyReceipt(row, receipts.at(-1), options)
    receipts.push(Object.freeze(row))
  }
  return receipts
}
async function readLedger(options: PhantomStudyStoreOptions): Promise<PhantomStudyReceipt[]> {
  validateOptions(options)
  // Reject symlink and insecure permissions, including on existing files.
  let fh
  try { fh = await open(options.path, constants.O_RDONLY | constants.O_NOFOLLOW) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  try {
    const info = await fh.stat()
    if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > MAX_BYTES) {
      throw new Error('PHANTOM_STUDY_INSECURE_OR_OVERSIZED_FILE')
    }
    return parseLedger(await fh.readFile({ encoding: 'utf8' }), options)
  } finally { await fh.close() }
}
export async function verifyPhantomAgentStudyLedger(options: PhantomStudyStoreOptions) {
  const rows = await readLedger(options)
  return Object.freeze({
    count: rows.length,
    headDigest: rows.at(-1)?.digest ?? ZERO,
    lastSlot: rows.at(-1)?.slot ?? null,
    authority: 'AUDIT_VERIFICATION_ONLY' as const,
    canExecute: false as const,
  })
}

export async function appendPhantomAgentStudy(input: Readonly<{
  options: PhantomStudyStoreOptions
  verified: PhantomAgentVerifiedNativeSol
  writtenAt?: string
}>): Promise<PhantomStudyReceipt> {
  const { options, verified } = input
  validateOptions(options)
  if (verified.provider !== 'solana-rpc-independent' ||
      verified.walletId !== options.expectedWalletId || verified.address !== options.expectedAddress ||
      verified.authority !== 'CHAIN_OBSERVATION_ONLY' || verified.financialAuthority !== 'NONE' ||
      verified.canSign !== false || verified.canExecute !== false || verified.canAuthorizeLive !== false ||
      verified.spendableBalanceMinor !== null || !HASH.test(verified.evidenceHash) ||
      !HASH.test(verified.phantomEvidenceHash) ||
      !Number.isSafeInteger(verified.slot) || verified.slot <= 0 ||
      !/^\d+$/.test(verified.balanceLamports)) {
    throw new Error('PHANTOM_STUDY_UNVERIFIED_EVIDENCE')
  }
  const now = input.writtenAt ?? new Date().toISOString()
  const nowMs = Date.parse(now), timeMs = Date.parse(verified.observedAt)
  if (!Number.isFinite(nowMs) || !Number.isFinite(timeMs) ||
      timeMs > nowMs + 30_000 || nowMs - timeMs > 120_000) {
    throw new Error('PHANTOM_STUDY_STALE_EVIDENCE')
  }
  // O_EXCL lock ensures one writer. If a process crashes with a stale lock,
  // stop and require owner repair rather than unsafe automatic lock stealing.
  const lockPath = options.path + '.lock'
  const lock = await open(lockPath, 'wx', 0o600)
  try {
    const existing = await readLedger(options)
    if (existing.length >= MAX_ROWS) throw new Error('PHANTOM_STUDY_LIMIT_REACHED')
    const previous = existing.at(-1)
    if (previous && (verified.slot < previous.slot ||
        Date.parse(now) < Date.parse(previous.writtenAt) ||
        verified.evidenceHash === previous.chainEvidenceHash)) {
      throw new Error('PHANTOM_STUDY_REPLAY_OR_OUT_OF_ORDER')
    }
    const body: ReceiptBody = {
      sequence: (previous?.sequence ?? 0) + 1,
      previousDigest: previous?.digest ?? ZERO,
      walletId: options.expectedWalletId,
      address: options.expectedAddress,
      balanceLamports: verified.balanceLamports,
      slot: verified.slot,
      observedAt: verified.observedAt,
      writtenAt: now,
      chainEvidenceHash: verified.evidenceHash,
      phantomEvidenceHash: verified.phantomEvidenceHash,
      authority: 'SHADOW_RESEARCH_ONLY',
      canExecute: false,
    }
    const receipt: PhantomStudyReceipt = Object.freeze({ ...body, digest: digest(body, options.hmacKey) })
    // O_NOFOLLOW avoids a symlink at the target path; append always fsyncs.
    const fh = await open(options.path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    try {
      const info = await fh.stat()
      if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size > MAX_BYTES) {
        throw new Error('PHANTOM_STUDY_INSECURE_OR_OVERSIZED_FILE')
      }
      await fh.writeFile(JSON.stringify(receipt) + '\n', { encoding: 'utf8' })
      await fh.sync()
    } finally { await fh.close() }
    return receipt
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

/** Controlled export into SHARK/SHADOW research. No orders, permits or P&L. */
export async function readPhantomAgentStudyForShadow(options: PhantomStudyStoreOptions) {
  const rows = await readLedger(options)
  return Object.freeze(rows.map(row => Object.freeze({
    caseId: 'phantom-agent-native-sol:' + row.digest,
    parentCaseId: row.sequence === 1 ? null : 'phantom-agent-native-sol:' + row.previousDigest,
    walletId: row.walletId,
    subjectId: 'wallet:solana:' + row.address,
    network: 'SOLANA' as const,
    observedAt: row.observedAt,
    slot: row.slot,
    nativeBalanceLamports: row.balanceLamports,
    evidenceIds: Object.freeze([
      'solana-rpc:balance:sha256:' + row.chainEvidenceHash,
      'phantom-agent-mcp:balances:sha256:' + row.phantomEvidenceHash,
      'phantom-study:hmac-sha256:' + row.digest,
    ]),
    caseKind: 'FORWARD_WALLET_OBSERVATION' as const,
    authority: 'SHADOW_LEARNING_ONLY' as const,
    canExecute: false as const,
    canAuthorizeLive: false as const,
    simulatedPnl: null,
    realizedPnl: null,
  })))
}
