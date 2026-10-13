import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { verifyPhantomAgentStudyLedger, type PhantomStudyStoreOptions } from './phantom-agent-study-ledger.js'

/** Encrypted archive, **not** a proof of remote upload or isolated restoration. */
const SCHEMA = 'jhadina.phantom-agent.encrypted-study-backup.v1'
const HEX = /^[a-f0-9]{64}$/
const MAX_JOURNAL_BYTES = 16 * 1024 * 1024
const MAX_ARCHIVE_BYTES = MAX_JOURNAL_BYTES + 8192
type Archive = {
  schema: typeof SCHEMA
  head: string
  count: number
  sourceSha256: string
  nonce: string
  ciphertext: string
  tag: string
}
export type PhantomBackupReceipt = Readonly<{
  schema: typeof SCHEMA
  head: string
  count: number
  archiveSha256: string
  sourceSha256: string
  canExecute: false
  offHostCertified: false
}>

function secret(hexKey: string) {
  if (!HEX.test(hexKey)) throw new Error('PHANTOM_BACKUP_ENCRYPTION_KEY_REQUIRED')
  return Buffer.from(hexKey, 'hex')
}
async function journalBytes(options: PhantomStudyStoreOptions): Promise<Buffer> {
  const file = await open(options.path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const info = await file.stat()
    if (!info.isFile() || info.size > MAX_JOURNAL_BYTES || (info.mode & 0o077) !== 0) {
      throw new Error('PHANTOM_BACKUP_SOURCE_UNSAFE')
    }
    return file.readFile()
  } finally { await file.close() }
}
function aad(archive: Pick<Archive, 'schema' | 'head' | 'count' | 'sourceSha256'>) {
  return Buffer.from(JSON.stringify({
    schema: archive.schema, head: archive.head,
    count: archive.count, sourceSha256: archive.sourceSha256,
  }))
}
function sha(bytes: Buffer) { return createHash('sha256').update(bytes).digest('hex') }

/**
 * Separate backup key MUST NOT equal the study HMAC key. The archive should
 * be uploaded off-host by an owner-reviewed backup facility. No cloud client
 * is silently launched here.
 */
export async function createEncryptedPhantomStudyBackup(input: Readonly<{
  options: PhantomStudyStoreOptions
  encryptionKeyHex: string
}>): Promise<Readonly<{ bytes: Buffer; receipt: PhantomBackupReceipt }>> {
  const key = secret(input.encryptionKeyHex)
  const before = await verifyPhantomAgentStudyLedger(input.options)
  const source = await journalBytes(input.options)
  const after = await verifyPhantomAgentStudyLedger(input.options)
  if (before.headDigest !== after.headDigest || before.count !== after.count) {
    throw new Error('PHANTOM_BACKUP_CONCURRENT_CHANGE')
  }
  const meta = {
    schema: SCHEMA, head: before.headDigest, count: before.count,
    sourceSha256: sha(source),
  } as const
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(aad(meta))
  const encrypted = Buffer.concat([cipher.update(source), cipher.final()])
  const archive: Archive = {
    ...meta,
    nonce: nonce.toString('hex'),
    ciphertext: encrypted.toString('base64'),
    tag: cipher.getAuthTag().toString('hex'),
  }
  const bytes = Buffer.from(JSON.stringify(archive))
  if (bytes.length > MAX_ARCHIVE_BYTES * 1.5) throw new Error('PHANTOM_BACKUP_ARCHIVE_TOO_LARGE')
  return Object.freeze({
    bytes,
    receipt: Object.freeze({
      schema: SCHEMA, head: meta.head, count: meta.count,
      archiveSha256: sha(bytes), sourceSha256: meta.sourceSha256,
      canExecute: false as const, offHostCertified: false as const,
    }),
  })
}

/**
 * Requires an INDEPENDENT trusted head/digest; never trust the archive's own
 * claims as the anchor. Restore ONLY to a brand-new isolated path (O_EXCL).
 */
export async function restoreEncryptedPhantomStudyBackup(input: Readonly<{
  archiveBytes: Buffer
  encryptionKeyHex: string
  trustedArchiveSha256: string
  trustedHeadDigest: string
  destination: PhantomStudyStoreOptions
}>): Promise<Readonly<{ count: number; headDigest: string; canExecute: false; isolatedRestoreVerified: true }>> {
  const key = secret(input.encryptionKeyHex)
  if (!HEX.test(input.trustedArchiveSha256) || !HEX.test(input.trustedHeadDigest) ||
      !isAbsolute(input.destination.path) || !input.archiveBytes.length ||
      input.archiveBytes.length > MAX_ARCHIVE_BYTES * 1.5 ||
      sha(input.archiveBytes) !== input.trustedArchiveSha256) {
    throw new Error('PHANTOM_BACKUP_TRUSTED_ANCHOR_OR_ARCHIVE_INVALID')
  }
  let raw: unknown
  try { raw = JSON.parse(input.archiveBytes.toString('utf8')) }
  catch { throw new Error('PHANTOM_BACKUP_ARCHIVE_INVALID') }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('PHANTOM_BACKUP_ARCHIVE_INVALID')
  const a = raw as Archive
  if (a.schema !== SCHEMA || a.head !== input.trustedHeadDigest ||
      !Number.isSafeInteger(a.count) || a.count <= 0 ||
      !HEX.test(a.sourceSha256) ||
      typeof a.nonce !== 'string' || !/^[a-f0-9]{24}$/.test(a.nonce) ||
      typeof a.tag !== 'string' || !/^[a-f0-9]{32}$/.test(a.tag) ||
      typeof a.ciphertext !== 'string') {
    throw new Error('PHANTOM_BACKUP_ARCHIVE_METADATA_INVALID')
  }
  let source: Buffer
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(a.nonce, 'hex'))
    decipher.setAAD(aad(a))
    decipher.setAuthTag(Buffer.from(a.tag, 'hex'))
    source = Buffer.concat([decipher.update(Buffer.from(a.ciphertext, 'base64')), decipher.final()])
  } catch { throw new Error('PHANTOM_BACKUP_DECRYPTION_FAILED') }
  if (source.length > MAX_JOURNAL_BYTES || sha(source) !== a.sourceSha256) {
    throw new Error('PHANTOM_BACKUP_SOURCE_HASH_MISMATCH')
  }
  let created = false
  try {
    const output = await open(input.destination.path,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600)
    created = true
    try { await output.writeFile(source); await output.sync() }
    finally { await output.close() }
    const verified = await verifyPhantomAgentStudyLedger(input.destination)
    if (verified.headDigest !== a.head || verified.count !== a.count) {
      throw new Error('PHANTOM_BACKUP_RESTORED_LEDGER_MISMATCH')
    }
    return Object.freeze({
      count: verified.count, headDigest: verified.headDigest,
      canExecute: false as const, isolatedRestoreVerified: true as const,
    })
  } catch (error) {
    if (created) await unlink(input.destination.path)
    throw error
  }
}
