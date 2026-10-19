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
  // Counts of qualifying text entries actually examined in parsed,
  // allowlisted JSON. Duplicates across shards are possible; not an
  // exhaustive account total, and no text is included in copied audits.
  observedWritingEntries?: number
  observedYears?: FacebookYearCoverage[]
  sampleLimitReached?: boolean
}>

/**
 * Local-only chronological coverage; counts describe bounded sampled writing,
 * never Facebook's total account activity or a stable personality.
 */
export type FacebookYearCoverage = Readonly<{
  year: string
  posts: number
  comments: number
  entries: number
}>

export function summarizeFacebookYears(samples: readonly WritingSample[]): FacebookYearCoverage[] {
  const byYear = new Map<string, { posts: number; comments: number }>()
  for (const sample of samples) {
    const year = sample.at?.slice(0, 4) || "Undated"
    const existing = byYear.get(year) ?? { posts: 0, comments: 0 }
    if (sample.kind === "post") existing.posts++
    else existing.comments++
    byYear.set(year, existing)
  }
  return [...byYear.entries()].sort(([a], [b]) => {
    if (a === "Undated") return 1
    if (b === "Undated") return -1
    return b.localeCompare(a)
  }).map(([year, counts]) => ({
    year, posts: counts.posts, comments: counts.comments,
    entries: counts.posts + counts.comments,
  }))
}

/**
 * Owner-initiated troubleshooting summary. No post text, comment text,
 * original file names, timestamps, sources, sample IDs or Drive links.
 * These are *preview counts*, never proof of complete Facebook coverage.
 */
export function formatFacebookAuditSummary(preview: FacebookImportPreview): string {
  const years = summarizeFacebookYears(preview.samples)
  return JSON.stringify({
    schema: "FB-IMPORT-LOCAL-COUNTS-v2",
    completeHistoryVerified: false,
    partialPreview: preview.truncated,
    eligibleJsonFilesRead: preview.filesRead,
    eligibleJsonFilesSkipped: preview.filesSkipped,
    sampledWritingTotal: preview.samples.length,
    observedRecognizedEntries: preview.observedWritingEntries ?? null,
    observedCountsScope: "recognized writing in parsed eligible JSON only; may include repeated writing within or across files; not complete Facebook account activity",
    observedYears: (preview.observedYears ?? []).map((year) => ({
      year: year.year, posts: year.posts, comments: year.comments,
      observedTotal: year.entries,
    })),
    sampleLimit: MAX_SAMPLES,
    perJsonByteLimit: MAX_FILE_BYTES,
    perArchiveJsonByteLimit: MAX_TOTAL_BYTES,
    perArchiveEligibleFileLimit: MAX_FILES,
    sampleLimitReached: preview.sampleLimitReached ?? preview.samples.length >= MAX_SAMPLES,
    sampledYears: years.map((year) => ({
      year: year.year,
      posts: year.posts,
      comments: year.comments,
      sampledTotal: year.entries,
    })),
    note: "Local bounded counts only; original Facebook writing and names excluded.",
  }, null, 2)
}


/**
 * A bounded, metadata-only diagnostic when a local iPhone ZIP fails BEFORE
 * the posts/comments preview. Never inspects names or decompresses any file.
 * Selected-file byte count can be compared to the Drive original privately.
 */
export async function inspectFacebookZipDirectory(file: Blob): Promise<string> {
  const result: Record<string, string | number | boolean | null> = {
    schema: "FB-LOCAL-ZIP-DIAGNOSTIC-v1",
    selectedFileBytes: file.size,
    zipEndRecordFound: false,
    zipEndRecordAtPhysicalEnd: false,
    zip64Indicated: false,
    declaredEntryCount: null,
    declaredDirectoryBytes: null,
    declaredDirectoryOffset: null,
    directoryEndBeyondSelectedFile: null,
    apparentDirectoryStartSignature: null,
    note: "Metadata-only local check. No file names, posts, comments or account data.",
  }
  try {
    if (file.size < 22) return JSON.stringify(result, null, 2)
    const start = Math.max(0, file.size - 65557)
    const bytes = await file.slice(start).arrayBuffer()
    const tail = new DataView(bytes)
    let end = -1
    // Prefer a correctly terminated EOCD rather than a signature appearing
    // inside the ZIP comment or random binary data.
    for (let i = tail.byteLength - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) !== 0x06054b50) continue
      const recordEnd = i + 22 + tail.getUint16(i + 20, true)
      if (recordEnd === tail.byteLength) { end = i; break }
    }
    if (end < 0) return JSON.stringify(result, null, 2)
    result.zipEndRecordFound = true
    result.zipEndRecordAtPhysicalEnd = true
    let count = tail.getUint16(end + 10, true)
    let size = tail.getUint32(end + 12, true)
    let offset = tail.getUint32(end + 16, true)
    const needs64 = count === 0xffff || size === 0xffffffff || offset === 0xffffffff
    result.zip64Indicated = needs64
    if (needs64) {
      const address = start + end - 20
      if (address >= 0) {
        const locator = new DataView(await file.slice(address, address + 20).arrayBuffer())
        if (locator.byteLength === 20 && locator.getUint32(0, true) === 0x07064b50 &&
            locator.getUint32(4, true) === 0 && locator.getUint32(16, true) === 1) {
          const big = locator.getBigUint64(8, true)
          if (big < BigInt(file.size) && big + 56n <= BigInt(file.size)) {
            const info = new DataView(await file.slice(Number(big), Number(big) + 56).arrayBuffer())
            if (info.byteLength === 56 && info.getUint32(0, true) === 0x06064b50 &&
                info.getUint32(16, true) === 0 && info.getUint32(20, true) === 0) {
              const values = [info.getBigUint64(32, true), info.getBigUint64(40, true), info.getBigUint64(48, true)]
              if (values.every((value) => value <= BigInt(Number.MAX_SAFE_INTEGER))) {
                count = Number(values[0]); size = Number(values[1]); offset = Number(values[2])
              }
            }
          }
        }
      }
    }
    result.declaredEntryCount = needs64 && count === 0xffff ? null : count
    result.declaredDirectoryBytes = size === 0xffffffff ? null : size
    result.declaredDirectoryOffset = offset === 0xffffffff ? null : offset
    if (result.declaredDirectoryBytes !== null && result.declaredDirectoryOffset !== null) {
      result.directoryEndBeyondSelectedFile = !Number.isSafeInteger(offset + size) || offset + size > file.size
    }
    // Read only the first four bytes of a candidate anchored immediately
    // before EOCD. This is an observation, NOT proof of safe repair.
    if (!needs64 && size >= 46) {
      const physical = start + end - size
      if (physical >= 0 && physical + 4 <= file.size) {
        const signature = new DataView(await file.slice(physical, physical + 4).arrayBuffer())
        result.apparentDirectoryStartSignature = signature.byteLength === 4 &&
          signature.getUint32(0, true) === 0x02014b50
      }
    }
  } catch {
    // Local provider may be unable to serve a slice; do not leak errors,
    // private paths, or file metadata beyond the fixed summary schema.
  }
  return JSON.stringify(result, null, 2)
}

/**
 * Distinguish an unsuccessful importer stage from unchanged original EOCD
 * metadata. Never copy raw Error.message: browser/provider exceptions can
 * contain user paths or other private data. All output keys and values are
 * fixed categories or numeric counters generated by this application.
 */
export async function diagnoseFacebookZipImportFailure(
  file: Blob, failure: unknown, lastProgress = "",
): Promise<string> {
  const metadata = JSON.parse(await inspectFacebookZipDirectory(file)) as Record<string, unknown>
  const message = failure instanceof Error ? failure.message : ""
  const reasons: ReadonlyArray<readonly [string, string]> = [
    ["ZIP directory entries do not match the declared index; no recovery performed", "DIRECTORY_COUNT_OR_SPAN_MISMATCH"],
    ["Recovered ZIP directory references invalid local headers", "RECOVERED_LOCAL_OFFSETS_INVALID"],
    ["Recovered ZIP local offset validation failed", "RECOVERED_LOCAL_OFFSET_VALIDATION_FAILED"],
    ["Recovered ZIP local offset is ambiguous", "RECOVERED_LOCAL_OFFSET_AMBIGUOUS"],

    ["Recovered ZIP writing entry failed validation; no data imported", "RECOVERED_SELECTED_ENTRY_INVALID"],
    ["ZIP directory points beyond the archive; verify the download is complete", "OUT_OF_BOUNDS_DIRECTORY_UNRECOVERABLE"],
    ["Invalid ZIP directory entry", "DIRECTORY_ENTRY_INVALID"],
    ["Truncated ZIP directory entry", "DIRECTORY_ENTRY_TRUNCATED"],
    ["Unsafe ZIP directory recovery", "RECOVERY_GUARD_REJECTED"],
    ["Missing ZIP64 size information", "ZIP64_SIZE_MISSING"],
    ["The ZIP archive is incomplete", "ARCHIVE_TOO_SMALL"],
    ["Could not read the Facebook ZIP directory", "ZIP_END_RECORD_MISSING"],
    ["No supported self-authored posts or comments JSON found in this export", "NO_ELIGIBLE_WRITING_FILES"],
    ["This ZIP compression method is not supported on this device", "UNSUPPORTED_COMPRESSION"],
    ["Facebook import cancelled", "CANCELLED"],
  ]
  const code = reasons.find(([known]) => known === message)?.[1] ?? "OTHER_IMPORT_FAILURE"
  const progress = /^Archive (\d{1,2})\/(\d{1,2}): (\d{1,9})\/(\d{1,9}) (ZIP entries scanned|eligible files)$/.exec(lastProgress)
  return JSON.stringify({
    ...metadata,
    schema: "FB-LOCAL-ZIP-FAILURE-DIAGNOSTIC-v2",
    importFailureCode: code,
    lastProgressPhase: progress ? (progress[5] === "ZIP entries scanned" ? "directory_scan" : "eligible_json") : "not_started",
    lastProgressProcessed: progress ? Number(progress[3]) : null,
    lastProgressTotal: progress ? Number(progress[4]) : null,
    note: "Local diagnostic contains only bounded numbers and fixed failure categories; no posts, original filenames or account data.",
  }, null, 2)
}

const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_TOTAL_BYTES = 32 * 1024 * 1024
// The largest all-time exports are media-heavy. Scan ZIP directory entries
// without unpacking media, while keeping strict metadata and JSON limits.
const MAX_CENTRAL_BYTES = 192 * 1024 * 1024
const MAX_ZIP_ENTRIES = 400_000
// Never materialize the entire directory on an iPhone. ZIP variable-size
// central records cannot exceed 46 + 3*65535 bytes each.
const ZIP_DIRECTORY_WINDOW = 256 * 1024
const MAX_FILES = 80
const MAX_SAMPLES = 2500
const decoder = new TextDecoder()


/** Numeric census only; never holds post bodies outside the bounded sampler. */
class WritingCoverageCounter {
  total = 0
  private groups = new Map<string, { posts: number; comments: number }>()
  add(sample: WritingSample): void {
    this.total++
    const year = sample.at?.slice(0, 4) || "Undated"
    const cell = this.groups.get(year) ?? { posts: 0, comments: 0 }
    cell[sample.kind === "post" ? "posts" : "comments"]++
    this.groups.set(year, cell)
  }
  merge(other?: readonly FacebookYearCoverage[]): void {
    if (!other) return
    for (const item of other) {
      const cell = this.groups.get(item.year) ?? { posts: 0, comments: 0 }
      cell.posts += item.posts
      cell.comments += item.comments
      this.groups.set(item.year, cell)
      this.total += item.entries
    }
  }
  years(): FacebookYearCoverage[] {
    return [...this.groups].sort(([a], [b]) => {
      if (a === "Undated") return 1
      if (b === "Undated") return -1
      return b.localeCompare(a)
    }).map(([year, { posts, comments }]) => ({ year, posts, comments, entries: posts + comments }))
  }
}

/**
 * Bounded, deterministic, year-and-kind-aware sampling. A newly discovered
 * stratum can take a slot from an overrepresented one while retaining the
 * 2500-sample global ceiling. Counts come from the census, not the sample.
 * The sampled bodies never leave the browser or enter an unbounded Set.
 */
class BalancedWritingSampler {
  private groups = new Map<string, WritingSample[]>()
  private seenCounts = new Map<string, number>()
  private sampledKeys = new Set<string>()
  private size = 0
  offered = 0
  private hash(value: number): number {
    let h = (value + 0x9e3779b9) >>> 0
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
    return (h ^ (h >>> 16)) >>> 0
  }
  add(sample: WritingSample): void {
    this.offered++
    const bucketKey = (sample.at?.slice(0, 4) || "Undated") + ":" + sample.kind
    const count = (this.seenCounts.get(bucketKey) ?? 0) + 1
    this.seenCounts.set(bucketKey, count)
    const uniqueKey = sample.kind + ":" + sample.text.trim().toLowerCase()
    if (this.sampledKeys.has(uniqueKey)) return
    let group = this.groups.get(bucketKey)
    if (!group) {
      group = []
      this.groups.set(bucketKey, group)
    }
    const keep = (value: WritingSample) => {
      group!.push(value)
      this.sampledKeys.add(uniqueKey)
      this.size++
    }
    if (this.size < MAX_SAMPLES) { keep(sample); return }
    const fairFloor = Math.max(1, Math.floor(MAX_SAMPLES / this.groups.size))
    if (group.length < fairFloor) {
      let donorKey: string | undefined
      let donorSurplus = -Infinity
      for (const [key, array] of this.groups) {
        if (key === bucketKey || !array.length) continue
        const surplus = array.length - fairFloor
        if (surplus > donorSurplus) { donorSurplus = surplus; donorKey = key }
      }
      if (donorKey) {
        const donor = this.groups.get(donorKey)!
        const donorIndex = this.hash(this.offered) % donor.length
        const previous = donor[donorIndex]
        donor[donorIndex] = donor[donor.length - 1]
        donor.pop()
        this.sampledKeys.delete(previous.kind + ":" + previous.text.trim().toLowerCase())
        this.size--
        keep(sample)
        return
      }
    }
    // Deterministic within-stratum reservoir, not newest-first or first-file
    // bias. Do not retain all discarded writing in a list or Set.
    if (group.length && this.hash(this.offered ^ count) % count < group.length) {
      const slot = this.hash(this.offered + count) % group.length
      const previous = group[slot]
      this.sampledKeys.delete(previous.kind + ":" + previous.text.trim().toLowerCase())
      group[slot] = sample
      this.sampledKeys.add(uniqueKey)
    }
  }
  values(): WritingSample[] { return [...this.groups.values()].flat() }
}

export type ParsedWritingCoverage = Readonly<{
  samples: WritingSample[]
  observedWritingEntries: number
  observedYears: FacebookYearCoverage[]
}>

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
export function parseOwnWritingJsonWithCoverage(json: unknown, path: string): ParsedWritingCoverage {
  const kind = classifyOwnWritingFile(path)
  if (!kind) return { samples: [], observedWritingEntries: 0, observedYears: [] }
  const sampler = new BalancedWritingSampler()
  const census = new WritingCoverageCounter()
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
    const writing = { kind, text, source: path, at: atTime(entry.timestamp ?? entry.created_timestamp) }
    census.add(writing)
    sampler.add(writing)
  }
  return { samples: sampler.values(), observedWritingEntries: census.total, observedYears: census.years() }
}

/** Legacy preview helper preserved for already-connected personality signals. */
export function parseOwnWritingJson(json: unknown, path: string): WritingSample[] {
  return parseOwnWritingJsonWithCoverage(json, path).samples
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
  recoveredIndex?: boolean
  localOffsetBias?: number
  recoveredDirectoryStart?: number
}>

/** Parse ZIP/ZIP64 directory metadata without decompressing unrelated files. */
function safe64(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("ZIP64 metadata exceeds safe size")
  return Number(value)
}

async function zipEntries(
  file: Blob, signal?: AbortSignal, onProgress?: (scanned: number, total: number) => void,
): Promise<ZipEntry[]> {
  if (file.size < 22) throw new Error("The ZIP archive is incomplete")
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  const start = Math.max(0, file.size - 65557)
  const tail = new DataView(await file.slice(start).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50 && i + 22 + tail.getUint16(i + 20, true) === tail.byteLength) {
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
  const zip64 = count === 0xffff || size === 0xffffffff || offset === 0xffffffff
  if (zip64) {
    // ZIP64 locator must occur immediately before the classic EOCD.
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
  if (count > MAX_ZIP_ENTRIES) {
    throw new Error("This ZIP contains too many files for a safe iPhone scan; export Posts and Comments only")
  }
  if (size > MAX_CENTRAL_BYTES) {
    throw new Error("This ZIP contains too much file-index metadata for a safe iPhone scan; export Posts and Comments only")
  }
  const declaredOffset = offset
  const classicEndRecordAt = start + eocd
  const declaredDirectoryInvalid =
    !Number.isSafeInteger(offset + size) || offset + size > classicEndRecordAt
  let reconciledDirectoryOffset = false
  if (declaredDirectoryInvalid) {
    // Some valid single-file exports contain an inconsistent EOCD central
    // offset despite an intact central directory directly before the EOCD.
    // Recovery is permitted ONLY for non-ZIP64, single-disk archives where
    // an anchored central header exists at EOCD - declared directory size.
    // The full count, exact terminal boundary and selected local headers
    // are checked below; no blind offset rewriting or original ZIP mutation.
    const candidate = classicEndRecordAt - size
    if (zip64 || count === 0 || size < 46 || candidate < 0 || candidate >= classicEndRecordAt) {
      throw new Error("ZIP directory points beyond the archive; verify the download is complete")
    }
    const signature = new DataView(await file.slice(candidate, candidate + 4).arrayBuffer())
    if (signature.byteLength !== 4 || signature.getUint32(0, true) !== 0x02014b50) {
      throw new Error("ZIP directory points beyond the archive; verify the download is complete")
    }
    offset = candidate
    reconciledDirectoryOffset = true
  }

  // Scan media-heavy central directories with small Blob slices. Never allocate
  // 192 MiB in Safari and never inflate photos or non-owner data.
  const centralEnd = offset + size
  let windowStart = -1
  let central = new DataView(new ArrayBuffer(0))
  const windowAt = async (absolute: number, required: number): Promise<number> => {
    if (absolute < offset || absolute + required > centralEnd || required > ZIP_DIRECTORY_WINDOW) {
      throw new Error("Truncated ZIP directory entry")
    }
    if (absolute < windowStart || absolute + required > windowStart + central.byteLength) {
      windowStart = absolute
      central = new DataView(await file.slice(absolute,
        Math.min(centralEnd, absolute + ZIP_DIRECTORY_WINDOW)).arrayBuffer())
      if (central.byteLength < required) throw new Error("Truncated ZIP directory entry")
    }
    return absolute - windowStart
  }
  const entries: ZipEntry[] = []
  let pos = offset
  onProgress?.(0, count)
  for (let i = 0; i < count; i++) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    const header = await windowAt(pos, 46)
    if (central.getUint32(header, true) !== 0x02014b50) {
      throw new Error("Invalid ZIP directory entry")
    }
    const nameLength = central.getUint16(header + 28, true)
    const extraLength = central.getUint16(header + 30, true)
    const commentLength = central.getUint16(header + 32, true)
    const recordBytes = 46 + nameLength + extraLength + commentLength
    const recordStart = await windowAt(pos, recordBytes)
    const name = decoder.decode(new Uint8Array(central.buffer,
      central.byteOffset + recordStart + 46, nameLength))
    let compressed = central.getUint32(recordStart + 20, true)
    let uncompressed = central.getUint32(recordStart + 24, true)
    let localOffset = central.getUint32(recordStart + 42, true)
    const extraStart = recordStart + 46 + nameLength
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
        name, flags: central.getUint16(recordStart + 8, true),
        method: central.getUint16(recordStart + 10, true),
        compressed, uncompressed, localOffset, recoveredIndex: reconciledDirectoryOffset,
        localOffsetBias: reconciledDirectoryOffset ? declaredOffset - offset : undefined,
        recoveredDirectoryStart: reconciledDirectoryOffset ? offset : undefined,
      })
    }
    pos += recordBytes
    if (i % 1024 === 1023) {
      onProgress?.(i + 1, count)
      // Yield to WebKit's UI thread so cancellation remains available.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  if (pos !== centralEnd || (reconciledDirectoryOffset && centralEnd !== classicEndRecordAt)) {
    throw new Error("ZIP directory entries do not match the declared index; no recovery performed")
  }
  if (reconciledDirectoryOffset) {
    // "declaredOffset" stays available as audit evidence but never guides
    // Blob slicing or any write to the owner's original archive.
    if (declaredOffset <= file.size || offset + size !== classicEndRecordAt) {
      throw new Error("Unsafe ZIP directory recovery")
    }
    const bias = declaredOffset - offset
    if (!Number.isSafeInteger(bias) || bias <= 0) {
      throw new Error("Unsafe ZIP directory recovery")
    }
    // Selected owner-writing entries will validate raw and bias-adjusted
    // local headers. Non-owner media remains unread.
  }
  onProgress?.(count, count)
  return entries
}

/**
 * Choose across the entire ZIP directory instead of taking only its first 80
 * writing files. Preserve both posts and comments where present, without
 * inspecting titles, media, private messages or other excluded data.
 */
function selectWritingEntries(entries: readonly ZipEntry[]): ZipEntry[] {
  if (entries.length <= MAX_FILES) return [...entries]
  const posts = entries.filter((entry) => classifyOwnWritingFile(entry.name) === "post")
  const comments = entries.filter((entry) => classifyOwnWritingFile(entry.name) === "comment")
  const spread = (group: readonly ZipEntry[], count: number): ZipEntry[] => {
    if (!count) return []
    if (count >= group.length) return [...group]
    if (count === 1) return [group[Math.floor(group.length / 2)]]
    return Array.from({ length: count }, (_, i) =>
      group[Math.floor(i * (group.length - 1) / (count - 1))])
  }
  if (!posts.length) return spread(comments, MAX_FILES)
  if (!comments.length) return spread(posts, MAX_FILES)
  let commentCount = Math.max(1, Math.min(MAX_FILES - 1, comments.length,
    Math.round(MAX_FILES * comments.length / entries.length)))
  let postCount = Math.min(posts.length, MAX_FILES - commentCount)
  commentCount += Math.min(MAX_FILES - postCount - commentCount, comments.length - commentCount)
  postCount += Math.min(MAX_FILES - postCount - commentCount, posts.length - postCount)
  return [...spread(posts, postCount), ...spread(comments, commentCount)]
    .sort((a, b) => a.localOffset - b.localOffset)
}

/**
 * A recovered central directory can have the same constant byte displacement
 * in individual local offsets. Probe ONLY the raw and exactly corrected
 * positions, and require unique matching local header metadata. Do not
 * search for arbitrary ZIP signatures or unpack non-owner media.
 */
async function validatedLocalDataStart(file: Blob, entry: ZipEntry, signal?: AbortSignal): Promise<number> {
  const offsets = [entry.localOffset]
  if (entry.recoveredIndex) {
    const bias = entry.localOffsetBias
    if (bias === undefined || !Number.isSafeInteger(bias) || bias <= 0 ||
        entry.recoveredDirectoryStart === undefined ||
        !Number.isSafeInteger(entry.recoveredDirectoryStart)) {
      throw new Error("Recovered ZIP local offset validation failed")
    }
    const adjusted = entry.localOffset - bias
    if (Number.isSafeInteger(adjusted) && adjusted >= 0 && adjusted !== entry.localOffset) {
      offsets.push(adjusted)
    }
  }
  const boundary = entry.recoveredIndex ? entry.recoveredDirectoryStart! : file.size
  let accepted: number | undefined
  for (const position of offsets) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    if (!Number.isSafeInteger(position) || position < 0 || position + 30 > boundary) continue
    const view = new DataView(await file.slice(position, position + 30).arrayBuffer())
    if (view.byteLength !== 30 || view.getUint32(0, true) !== 0x04034b50 ||
        view.getUint16(8, true) !== entry.method || view.getUint16(6, true) !== entry.flags) continue
    const nameLength = view.getUint16(26, true)
    const extraLength = view.getUint16(28, true)
    const nameEnd = position + 30 + nameLength
    const dataStart = nameEnd + extraLength
    if (!Number.isSafeInteger(dataStart + entry.compressed) ||
        nameEnd > boundary || dataStart + entry.compressed > boundary) continue
    const bytes = await file.slice(position + 30, nameEnd).arrayBuffer()
    if (decoder.decode(new Uint8Array(bytes)) !== entry.name) continue
    if (accepted !== undefined) throw new Error("Recovered ZIP local offset is ambiguous")
    accepted = dataStart
  }
  if (accepted === undefined) {
    throw new Error(entry.recoveredIndex ? "Recovered ZIP local offset validation failed" : "Invalid local ZIP entry")
  }
  return accepted
}

async function readZipJson(file: Blob, entry: ZipEntry, signal?: AbortSignal): Promise<string> {
  if (entry.flags & 1) throw new Error("Encrypted ZIP entries are unsupported")
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  if (entry.compressed > MAX_FILE_BYTES || entry.uncompressed > MAX_FILE_BYTES ||
      entry.localOffset === 0xffffffff || entry.compressed === 0xffffffff) {
    throw new Error("A JSON entry exceeds the import limit")
  }
  const start = await validatedLocalDataStart(file, entry, signal)
  const chunk = file.slice(start, start + entry.compressed)
  if (entry.method === 0) {
    const raw = await readBoundedStream(chunk.stream(), MAX_FILE_BYTES, signal)
    if (raw.byteLength !== entry.uncompressed) throw new Error("ZIP stored entry size mismatch")
    return decoder.decode(raw)
  }
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") {
    throw new Error("This ZIP compression method is not supported on this device")
  }
  const unpacked = await readBoundedStream(chunk.stream().pipeThrough(
    new DecompressionStream("deflate-raw")), MAX_FILE_BYTES, signal)
  if (unpacked.byteLength !== entry.uncompressed) throw new Error("ZIP uncompressed size mismatch")
  return decoder.decode(unpacked)
}

export async function previewFacebookExport(
  file: Blob, filename: string, signal?: AbortSignal,
  onProgress?: (progress: Readonly<{ processed: number; total: number; phase?: "directory" }>) => void,
): Promise<FacebookImportPreview> {
  if (signal?.aborted) throw new Error("Facebook import cancelled")
  if (!/\.(json|zip)$/i.test(filename)) throw new Error("Choose a Facebook JSON file or ZIP export")
  const selected: { path: string; read: () => Promise<string>; strictRecoveredIndex?: boolean }[] = []
  let skipped = 0
  if (/\.json$/i.test(filename)) {
    if (file.size > MAX_FILE_BYTES) throw new Error("JSON file is larger than the 8 MB limit")
    if (!classifyOwnWritingFile(filename)) throw new Error("Select your_posts or comments JSON, not messages or private account data")
    selected.push({ path: filename, read: () => file.text() })
  } else {
    const candidates: ZipEntry[] = []
    for (const entry of await zipEntries(file, signal, (scanned, total) =>
      onProgress?.({ processed: scanned, total, phase: "directory" }))) {
      if (entry.uncompressed > MAX_FILE_BYTES || entry.compressed > MAX_FILE_BYTES) {
        skipped++
        continue
      }
      candidates.push(entry)
    }
    const selectedEntries = selectWritingEntries(candidates)
    skipped += candidates.length - selectedEntries.length
    for (const entry of selectedEntries) {
      selected.push({ path: entry.name, read: () => readZipJson(file, entry, signal),
        strictRecoveredIndex: entry.recoveredIndex })
    }
  }
  if (selected.length === 0) throw new Error("No supported self-authored posts or comments JSON found in this export")
  let totalBytes = 0
  let filesRead = 0
  let processed = 0
  onProgress?.({ processed, total: selected.length })
  const sampler = new BalancedWritingSampler()
  const census = new WritingCoverageCounter()
  let truncated = skipped > 0
  for (const item of selected) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    let raw: string
    try { raw = await item.read() } catch (error) {
      if (signal?.aborted) throw error
      // Do not silently skip a damaged selected file after reconciling an
      // inconsistent central index: owner must know validation failed.
      if (item.strictRecoveredIndex) {
        throw new Error("Recovered ZIP writing entry failed validation; no data imported")
      }
      skipped++
      truncated = true
      processed++
      onProgress?.({ processed, total: selected.length })
      continue
    }
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    totalBytes += new TextEncoder().encode(raw).byteLength
    if (totalBytes > MAX_TOTAL_BYTES) {
      // Count this and remaining selected JSON as not examined. The cap is
      // intentionally per archive, even if the ZIP itself contains media.
      skipped += selected.length - processed
      truncated = true
      break
    }
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch {
      truncated = true
      skipped++
      processed++
      onProgress?.({ processed, total: selected.length })
      continue
    }
    filesRead++
    const parsedCoverage = parseOwnWritingJsonWithCoverage(parsed, item.path)
    census.merge(parsedCoverage.observedYears)
    for (const sample of parsedCoverage.samples) sampler.add(sample)
    processed++
    onProgress?.({ processed, total: selected.length })
  }
  const samples = sampler.values()
  const sampleLimitReached = samples.length >= MAX_SAMPLES || sampler.offered > MAX_SAMPLES
  // Census counts eligible text entries, not globally unique distinct posts;
  // the preview still cannot verify export completeness.
  if (sampleLimitReached) truncated = true
  return { samples, filesRead, filesSkipped: skipped, truncated,
    observedWritingEntries: census.total, observedYears: census.years(), sampleLimitReached }
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
  const sampler = new BalancedWritingSampler()
  const census = new WritingCoverageCounter()
  let read = 0
  let skipped = 0
  let partial = false
  let sampleLimitReached = false
  for (const [index, file] of files.entries()) {
    if (signal?.aborted) throw new Error("Facebook import cancelled")
    let result: FacebookImportPreview
    try {
      result = await previewFacebookExport(file.blob, file.name, signal, (progress) => {
        onProgress?.("Archive " + (index + 1) + "/" + files.length +
          ": " + progress.processed + "/" + progress.total +
          (progress.phase === "directory" ? " ZIP entries scanned" : " eligible files"))
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
    sampleLimitReached ||= result.sampleLimitReached ?? false
    census.merge(result.observedYears)
    for (const sample of result.samples) sampler.add(sample)
  }

  if (!read) throw new Error("No supported self-authored posts or comments JSON found in selected exports")
  const samples = sampler.values()
  return { samples, filesRead: read, filesSkipped: skipped,
    truncated: partial || samples.length >= MAX_SAMPLES || sampler.offered > MAX_SAMPLES,
    observedWritingEntries: census.total, observedYears: census.years(),
    sampleLimitReached: sampleLimitReached || samples.length >= MAX_SAMPLES || sampler.offered > MAX_SAMPLES }

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
