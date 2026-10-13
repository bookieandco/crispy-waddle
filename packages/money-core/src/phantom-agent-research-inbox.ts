import { createHmac, timingSafeEqual } from 'node:crypto'
import { constants } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  readPhantomAgentStudyForShadow, type PhantomStudyStoreOptions,
} from './phantom-agent-study-ledger.js'

/**
 * Persistent, idempotent research inbox for SHARK/SHADOW ingestion. Only exact
 * HMAC-verified study projections are admissible. No trade executor is called.
 * This is local owner-host durability, NOT a deployed SHARK/SHADOW database.
 */
type StudyCase = Awaited<ReturnType<typeof readPhantomAgentStudyForShadow>>[number]
type InboxRow = {
  sequence: number
  previousDigest: string
  sourceCaseId: string
  research: StudyCase
  authority: 'SHADOW_RESEARCH_INBOX_ONLY'
  canExecute: false
  digest: string
}
export type PhantomResearchInboxOptions = Readonly<{
  study: PhantomStudyStoreOptions
  inboxPath: string
  inboxHmacKey: string
}>
const ZERO = '0'.repeat(64)
const HEX = /^[a-f0-9]{64}$/
const MAX_BYTES = 32 * 1024 * 1024

function validate(o: PhantomResearchInboxOptions) {
  if (!isAbsolute(o.inboxPath) || o.inboxPath === o.study.path ||
      o.inboxHmacKey.length < 32 || o.inboxHmacKey === o.study.hmacKey) {
    throw new Error('PHANTOM_RESEARCH_INBOX_CONFIG_INVALID')
  }
}
function hash(input: Omit<InboxRow, 'digest'>, key: string) {
  return createHmac('sha256', key).update(JSON.stringify(input)).digest('hex')
}
async function readRows(o: PhantomResearchInboxOptions, source: readonly StudyCase[]): Promise<InboxRow[]> {
  let file
  try { file = await open(o.inboxPath, constants.O_RDONLY | constants.O_NOFOLLOW) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  let raw: string
  try {
    const st = await file.stat()
    if (!st.isFile() || (st.mode & 0o077) !== 0 || st.size > MAX_BYTES) {
      throw new Error('PHANTOM_RESEARCH_INBOX_FILE_UNSAFE')
    }
    raw = await file.readFile({ encoding: 'utf8' })
  } finally { await file.close() }
  if (!raw) return []
  if (!raw.endsWith('\n')) throw new Error('PHANTOM_RESEARCH_INBOX_TRUNCATED')
  const lines = raw.trimEnd().split('\n')
  if (lines.length > source.length) throw new Error('PHANTOM_RESEARCH_INBOX_SOURCE_ROLLBACK')
  const rows: InboxRow[] = []
  for (const line of lines) {
    let row: InboxRow
    try { row = JSON.parse(line) as InboxRow } catch {
      throw new Error('PHANTOM_RESEARCH_INBOX_INVALID_JSON')
    }
    const expectedCase = source[rows.length]
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
        row.sequence !== rows.length + 1 ||
        row.previousDigest !== (rows[rows.length - 1]?.digest ?? ZERO) ||
        row.sourceCaseId !== expectedCase?.caseId ||
        JSON.stringify(row.research) !== JSON.stringify(expectedCase) ||
        row.authority !== 'SHADOW_RESEARCH_INBOX_ONLY' || row.canExecute !== false ||
        !HEX.test(row.digest)) {
      throw new Error('PHANTOM_RESEARCH_INBOX_SOURCE_OR_CHAIN_INVALID')
    }
    const { digest, ...body } = row
    const actual = hash(body, o.inboxHmacKey)
    if (!timingSafeEqual(Buffer.from(actual,'hex'), Buffer.from(digest,'hex'))) {
      throw new Error('PHANTOM_RESEARCH_INBOX_HMAC_INVALID')
    }
    rows.push(Object.freeze(row))
  }
  return rows
}

/**
 * Idempotent: previously synced source cases are not re-appended. Strict
 * prefix binding prevents accepting missing/reordered/tampered prior cases.
 * O_EXCL lock makes concurrent ingestion fail rather than race.
 */
export async function syncPhantomAgentResearchInbox(o: PhantomResearchInboxOptions) {
  validate(o)
  const lock = await open(o.inboxPath + '.lock', 'wx', 0o600)
  try {
    const source = await readPhantomAgentStudyForShadow(o.study)
    const oldRows = await readRows(o, source)
    if (source.length > 10000) throw new Error('PHANTOM_RESEARCH_INBOX_LIMIT')
    const next: InboxRow[] = []
    let last = oldRows[oldRows.length - 1]
    for (let i = oldRows.length; i < source.length; i++) {
      const study = source[i]!
      const body: Omit<InboxRow, 'digest'> = {
        sequence: i + 1,
        previousDigest: last?.digest ?? ZERO,
        sourceCaseId: study.caseId,
        research: study,
        authority: 'SHADOW_RESEARCH_INBOX_ONLY',
        canExecute: false,
      }
      const row = Object.freeze({ ...body, digest: hash(body, o.inboxHmacKey) })
      next.push(row)
      last = row
    }
    if (next.length) {
      const file = await open(o.inboxPath, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600)
      try {
        const st = await file.stat()
        if (!st.isFile() || (st.mode & 0o077) !== 0 || st.size > MAX_BYTES) {
          throw new Error('PHANTOM_RESEARCH_INBOX_FILE_UNSAFE')
        }
        await file.writeFile(next.map(row => JSON.stringify(row) + '\n').join(''), { encoding: 'utf8' })
        await file.sync()
      } finally { await file.close() }
    }
    return Object.freeze({
      admitted: next.length, total: source.length,
      studyHead: source[source.length - 1]?.caseId ?? null,
      inboxHeadDigest: last?.digest ?? ZERO,
      authority: 'SHADOW_RESEARCH_INBOX_ONLY' as const,
      canExecute: false as const, canAuthorizeLive: false as const,
      deploymentCertified: false as const,
    })
  } finally {
    await lock.close()
    await unlink(o.inboxPath + '.lock')
  }
}
export async function readPhantomAgentResearchInbox(o: PhantomResearchInboxOptions) {
  validate(o)
  const source = await readPhantomAgentStudyForShadow(o.study)
  const rows = await readRows(o, source)
  return Object.freeze(rows.map(row => row.research))
}
