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
  // Profile/page exports mix owner and other-party material; do not infer authorship.
  if (/^posts_on_other_pages_and_profiles(?:_\d+)?\.json$/.test(name)) return null
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
    for (const key of ["posts", "your_posts", "status_updates", "comments", "comments_v2", "your_comments", "comments_you_made", "items", "entries"]) {
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

/** Parse ZIP/ZIP64 directory metadata without decompressing unrelated files. */
function safe64(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ZIP64 metadata exceeds safe size")
  return Number(value)
}

async function zipEntries(file: Blob): Promise<ZipEntry[]> {
  if (file.size < 22) throw new Error("The ZIP archive is incomplete")
  const start = Math.max(0, file.size - 65557)
  const tail = new DataView(await file.slice(start).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50 && i + 22 + tail.getUint16(i + 20, true) <= tail.byteLength) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("Could not read the Facebook ZIP directory")
  if (tail.getUint16(eocd + 4, true) !== 0 || tail.getUint16(eocd + 6, true) !== 0 ||
      tail.getUint16(eocd + 8, true) !== tail.getUint16(eocd + 10, true)) {
    throw new Error("Multi-disk ZIP archives are not supported")
  }

  let count = tail.getUint16(eocd + 10, true)
  let size = tail.getUint32(eocd + 12, true)
  let offset = tail.getUint32(eocd + 16, true)
  if (count === 0xffff || size === 0xffffffff || offset === 0xffffffff) {
    // ZIP64 EOCD locator is the 20-byte record immediately before classic EOCD.
    const locatorOffset = start + eocd - 20
    if (locatorOffset < 0) throw new Error("Missing ZIP64 locator")
    const locator = new DataView(await file.slice(locatorOffset, locatorOffset + 20).arrayBuffer())
    if (locator.byteLength !== 20 || locator.getUint32(0, true) !== 0x07064b50 ||
        locator.getUint32(4, true) !== 0 || locator.getUint32(16, true) !== 1) {
      throw new Error("Invalid ZIP64 locator or multi-disk archive")
    }
    const zip64Offset = safe64(locator.getBigUint64(8, true))
    if (zip64Offset >= locatorOffset || zip64Offset + 56 > file.size) throw new Error("ZIP64 header out of bounds")
    const extended = new DataView(await file.slice(zip64Offset, zip64Offset + 56).arrayBuffer())
    if (extended.getUint32(0, true) !== 0x06064b50 ||
        extended.getUint32(16, true) !== 0 || extended.getUint32(20, true) !== 0 ||
        extended.getBigUint64(24, true) !== extended.getBigUint64(32, true)) {
      throw new Error("Invalid ZIP64 directory header")
    }
    count = safe64(extended.getBigUint64(32, true))
    size = safe64(extended.getBigUint64(40, true))
    offset = safe64(extended.getBigUint64(48, true))
  }
  if (count > 10000 || size > MAX_CENTRAL_BYTES || offset + size > file.size) {
    throw new Error("ZIP directory exceeds safety limits")
  }

  const central = new DataView(await file.slice(offset, offset + size).arrayBuffer())
  const entries: ZipEntry[] = []
  let pos = 0
  for (let i = 0; i < count; i++) {
    if (pos + 46 > central.byteLength || central.getUint32(pos, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP directory entry")
    }
    const nameLength = central.getUint16(pos + 28, true)
    const extraLength = central.getUint16(pos + 30, true)
    const commentLength = central.getUint16(pos + 32, true)
    const next = pos + 46 + nameLength + extraLength + commentLength
    if (next > central.byteLength) throw new Error("Truncated ZIP directory entry")
    const name = decoder.decode(new Uint8Array(central.buffer, central.byteOffset + pos + 46, nameLength))
    let compressed = central.getUint32(pos + 20, true)
    let uncompressed = central.getUint32(pos + 24, true)
    let localOffset = central.getUint32(pos + 42, true)
    const extraStart = pos + 46 + nameLength
    let cursor = extraStart
    while (cursor < extraStart + extraLength) {
      if (cursor + 4 > extraStart + extraLength) throw new Error("Malformed ZIP extra field")
      const type = central.getUint16(cursor, true)
      const length = central.getUint16(cursor + 2, true)
      const end = cursor + 4 + length
      if (end > extraStart + extraLength) throw new Error("Truncated ZIP extra field")
      if (type === 0x0001) {
        let fieldPos = cursor + 4
        const take64 = () => {
          if (fieldPos + 8 > end) throw new Error("Truncated ZIP64 entry field")
          const number = safe64(central.getBigUint64(fieldPos, true))
          fieldPos += 8
          return number
        }
        if (uncompressed === 0xffffffff) uncompressed = take64()
        if (compressed === 0xffffffff) compressed = take64()
        if (localOffset === 0xffffffff) localOffset = take64()
      }
      cursor = end
    }
    if (uncompressed === 0xffffffff || compressed === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error("Missing ZIP64 size information")
    }
    if (classifyOwnWritingFile(name)) {
      entries.push({
        name, flags: central.getUint16(pos + 8, true), method: central.getUint16(pos + 10, true),
        compressed, uncompressed, localOffset,
      })
    }
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
  if (entry.method === 0) {
    const raw = await readBoundedStream(chunk.stream(), MAX_FILE_BYTES, signal)
    if (raw.byteLength !== entry.uncompressed) throw new Error("ZIP stored entry size mismatch")
    return decoder.decode(raw)
  }
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
      truncated = true
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

/**
 * Multi-part export support for iPhone/all-time history. Archives are processed
 * sequentially, deduplicated by authored text, and spread across years rather
 * than silently taking only the newest 2500 items. This remains a bounded
 * partial preview, not a full archive import or verified author identity.
 */
export async function previewFacebookExports(
  files: readonly { blob: Blob; name: string }[],
  signal?: AbortSignal,
  onProgress?: (label: string) => void,
): Promise<FacebookImportPreview> {
  if (!files.length || files.length > 6) throw new Error("Choose between one and six Facebook exports")
  const rawSamples: WritingSample[] = []
  let read = 0
  let skipped = 0
  let partial = false
  const seen = new Set<string>()
  for (const [index, file] of files.entries()) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    let result: FacebookImportPreview
    try {
      result = await previewFacebookExport(file.blob, file.name, signal, (progress) => {
        onProgress?.("Archive " + (index + 1) + "/" + files.length +
          ": " + progress.processed + "/" + progress.total + " eligible files")
      })
    } catch (error) {
      // All-time Meta exports can be split across several ZIPs, some with
      // no posts/comments. Skip only this known benign case, not broken ZIPs,
      // missing auth, unsupported compression or a cancelled import.
      if (signal?.aborted || !(error instanceof Error) ||
          error.message !== "No supported self-authored posts or comments JSON found in this export") throw error
      skipped++
      partial = true
      onProgress?.("Archive " + (index + 1) + "/" + files.length + ": no supported writing files")
      continue
    }
    read += result.filesRead
    skipped += result.filesSkipped
    partial ||= result.truncated
    for (const sample of result.samples) {
      const normalized = sample.kind + ":" + sample.text.trim().toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      rawSamples.push(sample)
    }
  }

  if (!read) throw new Error("No supported self-authored posts or comments JSON found in selected exports")
  const years = new Map<string, WritingSample[]>()
  for (const item of rawSamples) {
    const year = item.at?.slice(0, 4) ?? "unknown"
    const group = years.get(year) ?? []
    group.push(item)
    years.set(year, group)
  }
  const keys = [...years.keys()].sort((a, b) => b.localeCompare(a))
  const selected: WritingSample[] = []
  let cursor = 0
  while (selected.length < MAX_SAMPLES && keys.length) {
    for (let i = keys.length - 1; i >= 0; i--) {
      const group = years.get(keys[i])!
      if (cursor < group.length) {
        selected.push(group[cursor])
        if (selected.length === MAX_SAMPLES) break
      }
    }
    cursor++
    for (let i = keys.length - 1; i >= 0; i--) {
      if (cursor >= years.get(keys[i])!.length) keys.splice(i, 1)
    }
  }
  return { samples: selected, filesRead: read, filesSkipped: skipped, truncated: partial || rawSamples.length > selected.length }
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
