/**
 * Facebook owner-writing import (source-only). Raw archives remain in the
 * browser. This module never handles Messenger, friends, login data or media.
 * A ZIP reader uses bounded slices, not whole-archive decompression.
 */
export type WritingKind = "post" | "comment"
export type WritingSample = Readonly<{ kind: WritingKind; text: string; source: string; at?: string }>
export type FacebookImportPreview = Readonly<{
  samples: WritingSample[]
  filesRead: number
  filesSkipped: number
  truncated: boolean
}>

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 32 * 1024 * 1024
const MAX_CENTRAL_BYTES = 8 * 1024 * 1024
const MAX_FILES = 80
const MAX_SAMPLES = 2500
const decoder = new TextDecoder()

/** Explicit positive allowlist. Never classify direct/private-message files. */
export function classifyOwnWritingFile(path: string): WritingKind | null {
  const normalized = path.replace(/\\/g, "/").toLowerCase()
  const sections = normalized.split("/")
  if (sections.some((part) => part === ".." || part === ".")) return null
  if (sections.some((part) => /^(messages|inbox|friends|security|ads|advertisers|reactions|likes|groups|profile_information)$/.test(part))) return null
  const name = sections[sections.length - 1] ?? ""
  if (!name.endsWith(".json")) return null
  if (/^(your_posts|posts|status_updates)(?:_[a-z0-9_-]+)?\.json$/.test(name) &&
      (sections.length === 1 || sections.some((part) => part === "posts"))) return "post"
  if (/^(your_comments|comments_you_made|comments)(?:_[a-z0-9_-]+)?\.json$/.test(name) &&
      (sections.length === 1 || sections.some((part) => part === "comments" || part === "comments_and_reactions"))) return "comment"
  return null
}

function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  return value.length >= 4 ? value.slice(0, 2000) : null
}

function atTime(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return undefined
  const millis = value < 10 ** 11 ? value * 1000 : value
  const date = new Date(millis)
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 2004 &&
    date.getTime() <= Date.now() + 86_400_000 ? date.toISOString() : undefined
}

function entriesFromObject(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    for (const key of ["posts", "your_posts", "status_updates", "comments", "your_comments", "comments_you_made", "items", "entries"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
  }
  return []
}

/**
 * Extract only text fields that represent the account owner's own authored
 * post/comment. Never extract titles, attachments, recipients or thread bodies.
 */
export function parseOwnWritingJson(json: unknown, path: string): WritingSample[] {
  const kind = classifyOwnWritingFile(path)
  if (!kind) return []
  const results: WritingSample[] = []
  for (const unknownEntry of entriesFromObject(json)) {
    if (!unknownEntry || typeof unknownEntry !== "object") continue
    const entry = unknownEntry as Record<string, unknown>
    const data = Array.isArray(entry.data) ? entry.data : []
    const candidates: unknown[] = []
    if (kind === "post") {
      if (typeof entry.post === "string") candidates.push(entry.post)
      if (typeof entry.status === "string") candidates.push(entry.status)
      for (const value of data) {
        if (value && typeof value === "object") {
          const fields = value as Record<string, unknown>
          candidates.push(fields.post, fields.status)
        }
      }
    } else {
      if (typeof entry.comment === "string") candidates.push(entry.comment)
      for (const value of data) {
        if (!value || typeof value !== "object") continue
        const comment = (value as Record<string, unknown>).comment
        if (typeof comment === "string") candidates.push(comment)
        else if (comment && typeof comment === "object") {
          const fields = comment as Record<string, unknown>
          candidates.push(fields.text, fields.comment)
        }
      }
    }
    const text = candidates.map(cleanText).find((value): value is string => Boolean(value))
    if (!text) continue
    results.push({ kind, text, source: path, at: atTime(entry.timestamp ?? entry.created_timestamp) })
    if (results.length >= MAX_SAMPLES) break
  }
  return results
}

async function readBoundedStream(stream: ReadableStream<Uint8Array>, limit: number, signal?: AbortSignal): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      if (signal?.aborted) throw new Error("Facebook import cancelled")
      const { done, value } = await reader.read()
      if (signal?.aborted) throw new Error("Facebook import cancelled")
      if (done) break
      length += value.byteLength
      if (length > limit) throw new Error("Facebook export contains an oversized JSON file")
      chunks.push(value)
    }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
  const result = new Uint8Array(length)
  let position = 0
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.length }
  return result
}

type ZipEntry = Readonly<{
  name: string; localOffset: number; compressed: number; uncompressed: number; method: number; flags: number
}>

async function zipEntries(file: Blob): Promise<ZipEntry[]> {
  if (file.size < 22) throw new Error("The ZIP archive is incomplete")
  const start = Math.max(0, file.size - 65557)
  const tail = new DataView(await file.slice(start).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50 && i + 22 + tail.getUint16(i + 20, true) <= tail.byteLength) { eocd = i; break }
  }
  if (eocd < 0) throw new Error("Could not read the Facebook ZIP directory")
  if (tail.getUint16(eocd + 4, true) !== 0 || tail.getUint16(eocd + 6, true) !== 0 ||
      tail.getUint16(eocd + 8, true) !== tail.getUint16(eocd + 10, true)) {
    throw new Error("Multi-disk ZIP archives are not supported")
  }
  const count = tail.getUint16(eocd + 10, true)
  const size = tail.getUint32(eocd + 12, true)
  const offset = tail.getUint32(eocd + 16, true)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) throw new Error("ZIP64 exports are not supported yet")
  if (count > 10000 || size > MAX_CENTRAL_BYTES || offset + size > file.size) throw new Error("ZIP directory exceeds safety limits")
  const central = new DataView(await file.slice(offset, offset + size).arrayBuffer())
  const entries: ZipEntry[] = []
  let pos = 0
  for (let i = 0; i < count; i++) {
    if (pos + 46 > central.byteLength || central.getUint32(pos, true) !== 0x02014b50) throw new Error("Invalid ZIP directory entry")
    const nameLength = central.getUint16(pos + 28, true)
    const extraLength = central.getUint16(pos + 30, true)
    const commentLength = central.getUint16(pos + 32, true)
    const next = pos + 46 + nameLength + extraLength + commentLength
    if (next > central.byteLength) throw new Error("Truncated ZIP directory entry")
    const name = decoder.decode(new Uint8Array(central.buffer, central.byteOffset + pos + 46, nameLength))
    const entry = {
      name, flags: central.getUint16(pos + 8, true), method: central.getUint16(pos + 10, true),
      compressed: central.getUint32(pos + 20, true), uncompressed: central.getUint32(pos + 24, true),
      localOffset: central.getUint32(pos + 42, true),
    }
    if (classifyOwnWritingFile(name)) entries.push(entry)
    pos = next
  }
  return entries
}

async function readZipJson(file: Blob, entry: ZipEntry, signal?: AbortSignal): Promise<string> {
  if (entry.flags & 1) throw new Error("Encrypted ZIP entries are unsupported")
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  if (entry.compressed > MAX_FILE_BYTES || entry.uncompressed > MAX_FILE_BYTES ||
      entry.localOffset === 0xffffffff || entry.compressed === 0xffffffff) throw new Error("A JSON entry exceeds the import limit")
  const local = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer())
  if (local.byteLength !== 30 || local.getUint32(0, true) !== 0x04034b50) throw new Error("Invalid local ZIP entry")
  if (local.getUint16(8, true) !== entry.method || local.getUint16(6, true) !== entry.flags) throw new Error("Conflicting ZIP headers")
  const start = entry.localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true)
  if (start + entry.compressed > file.size) throw new Error("ZIP entry extends beyond archive")
  const localName = decoder.decode(new Uint8Array(await file.slice(entry.localOffset + 30, entry.localOffset + 30 + local.getUint16(26, true)).arrayBuffer()))
  if (localName !== entry.name) throw new Error("ZIP entry name mismatch")
  const chunk = file.slice(start, start + entry.compressed)
  if (entry.method === 0) return decoder.decode(await readBoundedStream(chunk.stream(), MAX_FILE_BYTES, signal))
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("This ZIP compression method is not supported on this device")
  const unpacked = await readBoundedStream(chunk.stream().pipeThrough(new DecompressionStream("deflate-raw")), MAX_FILE_BYTES, signal)
  if (unpacked.byteLength !== entry.uncompressed) throw new Error("ZIP uncompressed size mismatch")
  return decoder.decode(unpacked)
}

export async function previewFacebookExport(
  file: Blob, filename: string, signal?: AbortSignal,
  onProgress?: (progress: Readonly<{ processed: number; total: number }>) => void,
): Promise<FacebookImportPreview> {
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  if (!/\.(json|zip)$/i.test(filename)) throw new Error("Choose a Facebook JSON file or ZIP export")
  const selected: { path: string; read: () => Promise<string> }[] = []
  let skipped = 0
  if (/\.json$/i.test(filename)) {
    if (file.size > MAX_FILE_BYTES) throw new Error("JSON file is larger than the 8 MB limit")
    if (!classifyOwnWritingFile(filename)) throw new Error("Select your_posts or comments JSON, not messages or private account data")
    selected.push({ path: filename, read: () => file.text() })
  } else {
    for (const entry of await zipEntries(file)) {
      if (selected.length >= MAX_FILES || entry.uncompressed > MAX_FILE_BYTES || entry.compressed > MAX_FILE_BYTES) { skipped++; continue }
      selected.push({ path: entry.name, read: () => readZipJson(file, entry, signal) })
    }
  }
  if (selected.length === 0) throw new Error("No supported self-authored posts or comments JSON found in this export")
  let totalBytes = 0
  let filesRead = 0
  let processed = 0
  onProgress?.({ processed, total: selected.length })
  const samples: WritingSample[] = []
  const seen = new Set<string>()
  let truncated = skipped > 0
  for (const item of selected) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    let raw: string
    try { raw = await item.read() } catch (error) {
      if (signal?.aborted) throw error
      skipped++
      truncated = true
      processed++
      onProgress?.({ processed, total: selected.length })
      continue
    }
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    totalBytes += new TextEncoder().encode(raw).byteLength
    if (totalBytes > MAX_TOTAL_BYTES) { truncated = true; break }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch {
      skipped++
      processed++
      onProgress?.({ processed, total: selected.length })
      continue
    }
    filesRead++
    for (const sample of parseOwnWritingJson(parsed, item.path)) {
      const key = sample.kind + ":" + sample.text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      samples.push(sample)
      if (samples.length >= MAX_SAMPLES) { truncated = true; break }
    }
    processed++
    onProgress?.({ processed, total: selected.length })
    if (truncated && samples.length >= MAX_SAMPLES) break
  }
  return { samples, filesRead, filesSkipped: skipped, truncated }
}

export function writingStyleDraft(samples: readonly WritingSample[]): string {
  if (samples.length === 0) return ""
  const words = samples.map((sample) => sample.text.trim().split(/\s+/).length)
  const mean = Math.round(words.reduce((a, b) => a + b, 0) / samples.length)
  const questions = samples.filter((sample) => sample.text.includes("?")).length
  const exclamations = samples.filter((sample) => sample.text.includes("!")).length
  const emoji = samples.filter((sample) => /\p{Extended_Pictographic}/u.test(sample.text)).length
  const posts = samples.filter((sample) => sample.kind === "post").length
  const comments = samples.length - posts
  return "From " + samples.length + " self-authored Facebook writing samples (" + posts + " posts, " + comments +
    " comments), I average about " + mean + " words per entry; " + questions +
    " contain question marks, " + exclamations + " contain exclamation marks, and " + emoji +
    " contain emoji. These are tentative writing observations, not fixed personality traits or permission to imitate my identity."
}
