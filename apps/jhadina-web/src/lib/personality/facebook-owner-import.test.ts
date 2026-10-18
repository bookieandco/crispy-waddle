import { describe, expect, it } from "vitest"
import {
  classifyOwnWritingFile, parseOwnWritingJson, previewFacebookExport, previewFacebookExports, summarizeFacebookYears, formatFacebookAuditSummary, inspectFacebookZipDirectory, diagnoseFacebookZipImportFailure, writingStyleDraft,
} from "./facebook-owner-import"

const encoder = new TextEncoder()

function storedZip(path: string, body: string): Blob {
  const name = encoder.encode(path)
  const data = encoder.encode(body)
  const local = new Uint8Array(30 + name.length + data.length)
  const lv = new DataView(local.buffer)
  lv.setUint32(0, 0x04034b50, true)
  lv.setUint16(8, 0, true)
  lv.setUint32(18, data.length, true)
  lv.setUint32(22, data.length, true)
  lv.setUint16(26, name.length, true)
  local.set(name, 30)
  local.set(data, 30 + name.length)

  const central = new Uint8Array(46 + name.length)
  const cv = new DataView(central.buffer)
  cv.setUint32(0, 0x02014b50, true)
  cv.setUint16(10, 0, true)
  cv.setUint32(20, data.length, true)
  cv.setUint32(24, data.length, true)
  cv.setUint16(28, name.length, true)
  cv.setUint32(42, 0, true)
  central.set(name, 46)

  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 1, true)
  ev.setUint16(10, 1, true)
  ev.setUint32(12, central.length, true)
  ev.setUint32(16, local.length, true)
  return new Blob([local, central, end])
}


function storedZipMany(files: readonly { path: string; body: string }[]): Blob {
  const local: ArrayBuffer[] = []
  const central: ArrayBuffer[] = []
  let offset = 0
  let centralLength = 0
  for (const file of files) {
    const name = encoder.encode(file.path)
    const data = encoder.encode(file.body)
    const header = new Uint8Array(30 + name.length + data.length)
    const hv = new DataView(header.buffer)
    hv.setUint32(0, 0x04034b50, true)
    hv.setUint32(18, data.length, true)
    hv.setUint32(22, data.length, true)
    hv.setUint16(26, name.length, true)
    header.set(name, 30)
    header.set(data, 30 + name.length)
    local.push(header.buffer)
    const directory = new Uint8Array(46 + name.length)
    const dv = new DataView(directory.buffer)
    dv.setUint32(0, 0x02014b50, true)
    dv.setUint32(20, data.length, true)
    dv.setUint32(24, data.length, true)
    dv.setUint16(28, name.length, true)
    dv.setUint32(42, offset, true)
    directory.set(name, 46)
    central.push(directory.buffer)
    centralLength += directory.length
    offset += header.length
  }
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralLength, true)
  ev.setUint32(16, offset, true)
  return new Blob([...local, ...central, end.buffer])
}

async function zip64Directory(archive: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await archive.arrayBuffer())
  const end = new DataView(bytes.buffer, bytes.byteLength - 22, 22)
  const centralOffset = end.getUint32(16, true)
  const centralSize = end.getUint32(12, true)
  const prefix = bytes.slice(0, centralOffset + centralSize)
  const extended = new Uint8Array(56)
  const detail = new DataView(extended.buffer)
  detail.setUint32(0, 0x06064b50, true)
  detail.setBigUint64(4, 44n, true)
  detail.setUint16(12, 45, true)
  detail.setUint16(14, 45, true)
  detail.setBigUint64(24, 1n, true)
  detail.setBigUint64(32, 1n, true)
  detail.setBigUint64(40, BigInt(centralSize), true)
  detail.setBigUint64(48, BigInt(centralOffset), true)
  const locator = new Uint8Array(20)
  const lv = new DataView(locator.buffer)
  lv.setUint32(0, 0x07064b50, true)
  lv.setBigUint64(8, BigInt(prefix.byteLength), true)
  lv.setUint32(16, 1, true)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, 0xffff, true)
  ev.setUint16(10, 0xffff, true)
  ev.setUint32(12, 0xffffffff, true)
  ev.setUint32(16, 0xffffffff, true)
  return new Blob([prefix, extended, locator, eocd])
}

describe("owner-scoped Facebook export writing preview", () => {
  it("v2 diagnostics show safe failure stage without repeating original private browser errors", async () => {
    const fake = storedZip("posts/your_posts_secret.json", JSON.stringify([{
      timestamp: 1700000000, data: [{ post: "PRIVATE_HISTORICAL_WORDS" }],
    }]))
    const report = JSON.parse(await diagnoseFacebookZipImportFailure(
      fake, new Error("Recovered ZIP writing entry failed validation; no data imported"),
      "Archive 1/1: 42/8756 ZIP entries scanned",
    ))
    expect(report.schema).toBe("FB-LOCAL-ZIP-FAILURE-DIAGNOSTIC-v2")
    expect(report.importFailureCode).toBe("RECOVERED_SELECTED_ENTRY_INVALID")
    expect(report.lastProgressPhase).toBe("directory_scan")
    expect(report.lastProgressProcessed).toBe(42)
    expect(report.lastProgressTotal).toBe(8756)
    expect(report.declaredEntryCount).toBe(1)
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|your_posts|secret|2023/)
  })

  it("v2 diagnostics never echo untrusted local-provider error messages", async () => {
    const fake = storedZip("posts/your_posts_1.json", "[]")
    const report = JSON.parse(await diagnoseFacebookZipImportFailure(
      fake,
      new Error("Secret user path /private/fb-archive.zip 832AF0do-not-leak"),
      "Archive 1/1: 0/80 eligible files",
    ))
    expect(report.importFailureCode).toBe("OTHER_IMPORT_FAILURE")
    expect(report.lastProgressPhase).toBe("eligible_json")
    expect(report.lastProgressProcessed).toBe(0)
    expect(JSON.stringify(report)).not.toMatch(/Secret|private\/fb|832AF0|do-not-leak/)
  })

  it("v2 diagnostics handle no completed scanning step without inventing import acceptance", async () => {
    const fake = storedZip("posts/your_posts_1.json", "[]")
    const report = JSON.parse(await diagnoseFacebookZipImportFailure(
      fake, new Error("Invalid ZIP directory entry"), "Untrusted arbitrary text",
    ))
    expect(report.importFailureCode).toBe("DIRECTORY_ENTRY_INVALID")
    expect(report.lastProgressPhase).toBe("not_started")
    expect(report.lastProgressProcessed).toBeNull()
    expect(report.lastProgressTotal).toBeNull()
  })


  it("reports local numeric ZIP diagnostics without content or original paths", async () => {
    const archive = storedZip("posts/your_posts_secret.json", JSON.stringify([{
      timestamp: 1420000000, data: [{ post: "SECRET_PERSONAL_TEXT_DO_NOT_COPY" }],
    }]))
    const valid = JSON.parse(await inspectFacebookZipDirectory(archive))
    expect(valid.schema).toBe("FB-LOCAL-ZIP-DIAGNOSTIC-v1")
    expect(valid.selectedFileBytes).toBe(archive.size)
    expect(valid.zipEndRecordFound).toBe(true)
    expect(valid.apparentDirectoryStartSignature).toBe(true)
    expect(valid.directoryEndBeyondSelectedFile).toBe(false)
    expect(JSON.stringify(valid)).not.toContain("secret")
    expect(JSON.stringify(valid)).not.toContain("PERSONAL_TEXT")
    const bytes = new Uint8Array(await archive.arrayBuffer())
    new DataView(bytes.buffer, bytes.length - 22).setUint32(16, bytes.length + 1000, true)
    const bad = JSON.parse(await inspectFacebookZipDirectory(new Blob([bytes])))
    expect(bad.selectedFileBytes).toBe(archive.size)
    expect(bad.zipEndRecordFound).toBe(true)
    expect(bad.directoryEndBeyondSelectedFile).toBe(true)
    expect(bad.apparentDirectoryStartSignature).toBe(true)
    const end = new DataView(bytes.buffer, bytes.length - 22)
    end.setUint32(12, end.getUint32(12, true) + 1, true)
    await expect(previewFacebookExport(new Blob([bytes]), "broken.zip"))
      .rejects.toThrow(/directory points beyond the archive/)
  })

  it("describes incomplete iPhone Files ZIP copies without claiming original history is intact", async () => {
    const archive = storedZip("posts/your_posts_1.json", JSON.stringify([{
      timestamp: 1520000000, data: [{ post: "Only in the complete ZIP." }],
    }]))
    const clipped = archive.slice(0, archive.size - 11)
    const diagnostics = JSON.parse(await inspectFacebookZipDirectory(clipped))
    expect(diagnostics.selectedFileBytes).toBe(clipped.size)
    expect(diagnostics.zipEndRecordFound).toBe(false)
    expect(diagnostics.declaredDirectoryOffset).toBeNull()
    expect(JSON.stringify(diagnostics)).not.toContain("Only in")
  })


  it("copies only aggregate counts, never writing, source paths or private titles", () => {
    const preview = {
      samples: [
        { kind: "post" as const, source: "PRIVATE/posts/your_posts.json",
          text: "PRIVATE_OWNER_WRITING_NEVER_COPY", at: "2015-06-01T00:00:00Z" },
        { kind: "comment" as const, source: "PRIVATE/comments/comments.json",
          text: "PRIVATE_COMMENT_NEVER_COPY", at: "2026-08-01T00:00:00Z" },
      ], filesRead: 2, filesSkipped: 4, truncated: true,
    }
    const summary = formatFacebookAuditSummary(preview)
    expect(summary).toContain("FB-IMPORT-LOCAL-COUNTS-v1")
    expect(summary).toContain('"completeHistoryVerified": false')
    expect(summary).toContain('"sampledWritingTotal": 2')
    expect(summary).toContain('"year": "2015"')
    expect(summary).toContain('"year": "2026"')
    expect(summary).not.toContain("PRIVATE")
    expect(summary).not.toContain("your_posts.json")
    expect(summary).not.toContain("2026-08-01")
    expect(summary).not.toContain("2015-06-01")
  })


  it("flags an exact 2500-sample cap as incomplete historical coverage", async () => {
    const posts = Array.from({ length: 2500 }, (_, index) => ({
      timestamp: 1700000000,
      data: [{ post: "Synthetic bounded owner history record " + index + "." }],
    }))
    const result = await previewFacebookExport(new Blob([JSON.stringify(posts)]), "your_posts_1.json")
    expect(result.samples).toHaveLength(2500)
    expect(result.truncated).toBe(true)
    expect(result.filesRead).toBe(1)
  })

  it("preserves a rare post inside a comment-dominated all-time export", async () => {
    const comments = Array.from({ length: 200 }, (_, index) => ({
      path: "comments/comments_" + index + ".json",
      body: JSON.stringify([{ timestamp: 1720000000,
        data: [{ comment: { text: "Synthetic self-authored comment number " + index + "." } }] }]),
    }))
    const archive = storedZipMany([...comments, {
      path: "posts/your_posts_1.json",
      body: JSON.stringify([{ timestamp: 1420000000,
        data: [{ post: "Rare older owner post must not disappear." }] }]),
    }])
    const result = await previewFacebookExport(archive, "all-time-comments.zip")
    expect(result.filesRead).toBe(80)
    expect(result.filesSkipped).toBe(121)
    expect(result.samples.filter((item) => item.kind === "post")).toHaveLength(1)
    expect(result.samples.some((item) => item.text.includes("Rare older owner post"))).toBe(true)
  })

  it("does not stop at 2500 posts before reading a later older-year shard", async () => {
    const recent = Array.from({ length: 3000 }, (_, index) => ({
      timestamp: Math.floor(Date.UTC(2025, 6, 1) / 1000),
      data: [{ post: "Synthetic recent author line " + index + " without personal details." }],
    }))
    const older = [{ timestamp: Math.floor(Date.UTC(2009, 1, 1) / 1000),
      data: [{ post: "Distinct synthetic old writing from an early account year." }] }]
    const archive = storedZipMany([
      { path: "posts/your_posts_recent.json", body: JSON.stringify(recent) },
      { path: "posts/your_posts_older.json", body: JSON.stringify(older) },
    ])
    const first = await previewFacebookExport(archive, "owner-history.zip")
    const second = await previewFacebookExport(archive, "owner-history.zip")
    expect(first.filesRead).toBe(2)
    expect(first.samples).toHaveLength(2500)
    expect(first.truncated).toBe(true)
    expect(first.samples).toEqual(second.samples)
    expect(summarizeFacebookYears(first.samples).map((item) => item.year)).toEqual(["2025", "2009"])
    expect(first.samples.some((item) => item.text.includes("Distinct synthetic old writing"))).toBe(true)
  })

  it("samples across more than 80 eligible JSON files and reserves comment coverage", async () => {
    const posts = Array.from({ length: 120 }, (_, index) => ({
      path: "your_facebook_activity/posts/your_posts_" + index + ".json",
      body: JSON.stringify([{ timestamp: Math.floor(Date.UTC(2008 + index % 18, 1, 1) / 1000),
        data: [{ post: "Synthetic owner post #" + index + " from a historical year." }] }]),
    }))
    const comments = Array.from({ length: 3 }, (_, index) => ({
      path: "your_facebook_activity/comments_and_reactions/comments_" + index + ".json",
      body: JSON.stringify({ comments_v2: [
        { timestamp: 1600000000, data: [{ comment: { comment: "Synthetic owner comment #" + index + "." } }] },
      ] }),
    }))
    const archive = storedZipMany([...posts, ...comments])
    const one = await previewFacebookExport(archive, "owner-all-time.zip")
    const two = await previewFacebookExport(archive, "owner-all-time.zip")
    expect(one).toMatchObject({ filesRead: 80, filesSkipped: 43, truncated: true })
    expect(one.samples).toEqual(two.samples)
    expect(one.samples.filter((item) => item.kind === "comment")).toHaveLength(2)
    expect(one.samples.some((item) => item.text.includes("post #0 "))).toBe(true)
    expect(one.samples.some((item) => item.text.includes("post #119 "))).toBe(true)
    expect(one.samples.some((item) => item.text.includes("comment #0."))).toBe(true)
    expect(one.samples.some((item) => item.text.includes("comment #2."))).toBe(true)
  })




  it("previews a virtual 650 MiB ZIP using only bounded slices, not a full read", async () => {
    const base = new Uint8Array(await storedZip(
      "posts/your_posts_1.json",
      JSON.stringify([{ timestamp: 1320000000,
        data: [{ post: "A historically dated synthetic writing example." }] }]),
    ).arrayBuffer())
    const previous = new DataView(base.buffer, base.byteLength - 22)
    const centralStart = previous.getUint32(16, true)
    const centralLength = previous.getUint32(12, true)
    const virtualSize = 680688714
    const movedCentral = virtualSize - 22 - centralLength
    const ending = base.slice(base.byteLength - 22)
    new DataView(ending.buffer).setUint32(16, movedCentral, true)
    const regions = [
      { start: 0, data: base.slice(0, centralStart) },
      { start: movedCentral, data: base.slice(centralStart, centralStart + centralLength) },
      { start: virtualSize - 22, data: ending },
    ]
    let bytesRead = 0
    const virtual = {
      size: virtualSize,
      slice(start = 0, end = virtualSize): Blob {
        const output = new Uint8Array(end - start)
        bytesRead += output.length
        if (output.length > 65557) throw new Error("Unexpected bulk archive read")
        for (const region of regions) {
          const from = Math.max(start, region.start)
          const until = Math.min(end, region.start + region.data.length)
          if (until > from) output.set(region.data.subarray(from - region.start, until - region.start), from - start)
        }
        return new Blob([output])
      },
    } as unknown as Blob
    const result = await previewFacebookExport(virtual, "facebook-history.zip")
    expect(result.samples.map((item) => item.text)).toEqual([
      "A historically dated synthetic writing example.",
    ])
    expect(result.filesRead).toBe(1)
    expect(bytesRead).toBeLessThan(150000)
  })

  it("scans a 61,001-entry directory over 24 MiB with only small Safari Blob slices", async () => {
    const mediaName = "photos/" + "x".repeat(400) + ".jpg"
    const filename = "posts/your_posts_early.json"
    const archive = storedZipMany([
      { path: mediaName, body: "" },
      { path: filename, body: JSON.stringify([{
        timestamp: 1330000000,
        data: [{ post: "Synthetic earlier writing remains accessible after 61000 media entries." }],
      }]) },
    ])
    const original = new Uint8Array(await archive.arrayBuffer())
    const eocd = new DataView(original.buffer, original.length - 22)
    const centralOffset = eocd.getUint32(16, true)
    const mediaRecordLength = 46 + encoder.encode(mediaName).length
    const originalCentralEnd = original.length - 22
    const mediaRecord = original.subarray(centralOffset, centralOffset + mediaRecordLength)
    const ownerRecord = original.subarray(centralOffset + mediaRecordLength, originalCentralEnd)
    const copies = 61000
    const bigCentral = new Uint8Array(copies * mediaRecord.length + ownerRecord.length)
    for (let i = 0; i < copies; i++) bigCentral.set(mediaRecord, i * mediaRecord.length)
    bigCentral.set(ownerRecord, copies * mediaRecord.length)
    expect(bigCentral.length).toBeGreaterThan(24 * 1024 * 1024)
    const end = new Uint8Array(22)
    const view = new DataView(end.buffer)
    view.setUint32(0, 0x06054b50, true)
    view.setUint16(8, copies + 1, true)
    view.setUint16(10, copies + 1, true)
    view.setUint32(12, bigCentral.length, true)
    view.setUint32(16, centralOffset, true)
    const largeArchive = new Blob([
      original.slice(0, centralOffset).buffer as ArrayBuffer,
      bigCentral.buffer as ArrayBuffer, end.buffer,
    ])
    let maxSlice = 0
    let slices = 0
    const measured = {
      size: largeArchive.size,
      slice(from?: number, to?: number): Blob {
        const start = from ?? 0
        const end = to ?? largeArchive.size
        maxSlice = Math.max(maxSlice, end - start)
        slices++
        return largeArchive.slice(start, end)
      },
    } as Blob
    const progress: string[] = []
    const result = await previewFacebookExports([{
      blob: measured, name: "facebook-all-history.zip",
    }], undefined, (label) => {
      if (label.includes("ZIP entries scanned")) progress.push(label)
    })
    expect(result.filesRead).toBe(1)
    expect(result.samples).toHaveLength(1)
    expect(result.samples[0].text).toContain("Synthetic earlier writing")
    expect(result.samples[0].at?.slice(0, 4)).toBe("2012")
    expect(progress.length).toBeGreaterThan(1)
    expect(maxSlice).toBeLessThanOrEqual(256 * 1024)
    expect(slices).toBeGreaterThan(100)
  }, 30_000)

  it("lets iPhone cancel while the media-heavy directory is still being scanned", async () => {
    const files = Array.from({ length: 1200 }, () => ({
      path: "photos/duplicate.jpg", body: "",
    }))
    files.push({
      path: "posts/your_posts_1.json",
      body: JSON.stringify([{ timestamp: 1560000000,
        data: [{ post: "Owner writing should not be read after cancellation." }] }]),
    })
    const archive = storedZipMany(files)
    const controller = new AbortController()
    await expect(previewFacebookExport(archive, "cancel.zip", controller.signal, ({ processed, phase }) => {
      if (phase === "directory" && processed >= 1024) controller.abort()
    })).rejects.toThrow(/cancelled/)
  })

  it("recovers the owner's diagnosed out-of-file EOCD offset when the entire physical directory validates", async () => {
    const archive = storedZipMany([
      { path: "photos/unrelated.jpg", body: "" },
      { path: "posts/your_posts_2009.json",
        body: JSON.stringify([{ timestamp: 1235000000,
          data: [{ post: "Synthetic owner early writing." }] }]) },
      { path: "comments/comments_2026.json",
        body: JSON.stringify({ comments_v2: [{ timestamp: 1781000000,
          data: [{ comment: { comment: "Synthetic owner comment." } }] }] }) },
    ])
    const buffer = new Uint8Array(await archive.arrayBuffer())
    new DataView(buffer.buffer, buffer.length - 22).setUint32(16, 2152289679, true)
    const result = await previewFacebookExport(new Blob([buffer]), "owner-all-time.zip")
    expect(result.filesRead).toBe(2)
    expect(result.samples.map((x) => x.kind)).toEqual(["post", "comment"])
    expect(result.samples[0].text).toBe("Synthetic owner early writing.")
    expect(result.samples[1].text).toBe("Synthetic owner comment.")
    expect((await inspectFacebookZipDirectory(new Blob([buffer]))).includes('"directoryEndBeyondSelectedFile": true')).toBe(true)
  })

  it("validates a uniform displaced local-offset index without reading media", async () => {
    const files = [
      { path: "photos/private-sample.jpg", body: "not user writing" },
      { path: "posts/your_posts_2009.json", body: JSON.stringify([{
        timestamp: 1235000000, data: [{ post: "Synthetic historical writing." }],
      }]) },
      { path: "comments/comments_2026.json", body: JSON.stringify({
        comments_v2: [{ timestamp: 1781000000, data: [{ comment: {
          comment: "Synthetic comment after index offset reconciliation.",
        } }] }],
      }) },
    ]
    const archive = new Uint8Array(await storedZipMany(files).arrayBuffer())
    const eocd = new DataView(archive.buffer, archive.length - 22)
    const indexStart = eocd.getUint32(16, true)
    const indexSize = eocd.getUint32(12, true)
    const bias = 1472738576
    // Move only declared central and local offsets. Do NOT rewrite the actual
    // ZIP payload; reproduces offset inconsistency without private data.
    let cursor = indexStart
    for (const file of files) {
      const item = new DataView(archive.buffer, cursor)
      expect(item.getUint32(0, true)).toBe(0x02014b50)
      item.setUint32(42, item.getUint32(42, true) + bias, true)
      cursor += 46 + encoder.encode(file.path).length
    }
    expect(cursor).toBe(indexStart + indexSize)
    eocd.setUint32(16, indexStart + bias, true)
    const preview = await previewFacebookExport(new Blob([archive]), "account-history.zip")
    expect(preview.filesRead).toBe(2)
    expect(preview.samples.map((x) => x.kind)).toEqual(["post", "comment"])
    expect(preview.samples.some((x) => x.text === "Synthetic historical writing.")).toBe(true)
    expect(preview.samples.some((x) => x.text.includes("Synthetic comment after"))).toBe(true)
    expect(preview.samples.some((x) => x.text.includes("not user writing"))).toBe(false)
  })

  it("fails closed if neither raw nor uniformly adjusted local offset matches the stored filename", async () => {
    const path = "posts/your_posts_1.json"
    const archive = new Uint8Array(await storedZip(path, JSON.stringify([{
      timestamp: 1680000000, data: [{ post: "Do not import bad offset metadata." }],
    }])).arrayBuffer())
    const eocd = new DataView(archive.buffer, archive.length - 22)
    const indexStart = eocd.getUint32(16, true)
    const item = new DataView(archive.buffer, indexStart)
    const bias = 1472738576
    item.setUint32(42, item.getUint32(42, true) + bias + 1, true)
    eocd.setUint32(16, indexStart + bias, true)
    await expect(previewFacebookExport(new Blob([archive]), "bad-offset.zip"))
      .rejects.toThrow(/Recovered ZIP writing entry failed validation/)
  })

  it("rejects ambiguous recovered local references matching two distinct local headers", async () => {
    const path = "posts/your_posts_1.json"
    const file = { path, body: JSON.stringify([{
      timestamp: 1690000000, data: [{ post: "Synthetic duplicate local header." }],
    }]) }
    const original = new Uint8Array(await storedZipMany([file, file]).arrayBuffer())
    const eocd = new DataView(original.buffer, original.length - 22)
    const indexStart = eocd.getUint32(16, true)
    const firstOffset = 0
    const secondOffset = 30 + encoder.encode(path).length + encoder.encode(file.body).length
    const index0 = new DataView(original.buffer, indexStart)
    const bias = secondOffset
    // Raw points to the second valid local header. Correcting by the
    // EOCD displacement points to the first, also valid: must reject.
    index0.setUint32(42, secondOffset, true)
    eocd.setUint32(16, indexStart + bias, true)
    await expect(previewFacebookExport(new Blob([original]), "ambiguous.zip"))
      .rejects.toThrow(/Recovered ZIP writing entry failed validation/)
    expect(firstOffset).toBe(0)
  })

  it("never recovers a corrupt offset when the anchored directory signature is invalid", async () => {
    const original = new Uint8Array(await storedZip("posts/your_posts_1.json", "[]").arrayBuffer())
    const view = new DataView(original.buffer)
    const start = view.getUint32(original.length - 22 + 16, true)
    view.setUint32(start, 0x01020304, true)
    view.setUint32(original.length - 22 + 16, 2152289679, true)
    await expect(previewFacebookExport(new Blob([original]), "bad.zip"))
      .rejects.toThrow(/directory points beyond/)
  })

  it("never recovers a corrupt offset when the entry count or directory span mismatches", async () => {
    const original = new Uint8Array(await storedZip("posts/your_posts_1.json", "[]").arrayBuffer())
    const eocd = new DataView(original.buffer, original.length - 22)
    eocd.setUint32(16, 2152289679, true)
    eocd.setUint16(10, 2, true)
    eocd.setUint16(8, 2, true)
    await expect(previewFacebookExport(new Blob([original]), "bad-count.zip"))
      .rejects.toThrow(/Truncated ZIP directory entry|do not match/)
    const second = new Uint8Array(await storedZip("posts/your_posts_1.json", "[]").arrayBuffer())
    const end = new DataView(second.buffer, second.length - 22)
    end.setUint32(16, 2152289679, true)
    end.setUint32(12, end.getUint32(12, true) - 1, true)
    await expect(previewFacebookExport(new Blob([second]), "bad-span.zip"))
      .rejects.toThrow(/directory points beyond/)
  })

  it("never accepts recovered metadata when the selected local header is corrupt", async () => {
    const original = new Uint8Array(await storedZip("posts/your_posts_1.json", JSON.stringify([{
      data: [{ post: "Synthetic writing not from a corrupt local header." }],
    }])).arrayBuffer())
    const view = new DataView(original.buffer)
    view.setUint32(0, 0x00000000, true)
    view.setUint32(original.length - 22 + 16, 2152289679, true)
    await expect(previewFacebookExport(new Blob([original]), "broken-local.zip"))
      .rejects.toThrow(/Recovered ZIP writing entry failed validation/)
  })

  it("rejects a corrupt ZIP directory offset even with the larger streaming scan", async () => {
    const archive = storedZip("posts/your_posts_1.json", JSON.stringify([{
      timestamp: 1650000000, data: [{ post: "Synthetic account writing." }],
    }]))
    const bytes = new Uint8Array(await archive.arrayBuffer())
    const end = new DataView(bytes.buffer, bytes.length - 22)
    end.setUint32(16, bytes.length - 2, true)
    end.setUint32(12, end.getUint32(12, true) + 1, true)
    await expect(previewFacebookExport(new Blob([bytes.buffer as ArrayBuffer]), "corrupt.zip"))
      .rejects.toThrow(/directory points beyond the archive/)
  })

  it("scans a media-heavy 12,001-entry ZIP without unpacking photos or losing writing", async () => {
    // Valid stored ZIP: one synthetic owner JSON + 12,000 empty image entries.
    // It exercises the metadata path only; no real Facebook data is in CI.
    const contents = [
      { name: "your_facebook_activity/posts/your_posts_1.json",
        bytes: encoder.encode(JSON.stringify([{ timestamp: 1360000000,
          data: [{ post: "An older synthetic writing sample for the archive test." }] }])) },
      ...Array.from({ length: 12000 }, (_, i) => ({
        name: "your_facebook_activity/photos/image_" + i + ".jpg", bytes: new Uint8Array(),
      })),
    ]
    const locals: Uint8Array[] = []
    const central: Uint8Array[] = []
    let offset = 0
    let centralSize = 0
    for (const item of contents) {
      const name = encoder.encode(item.name)
      const local = new Uint8Array(30 + name.length + item.bytes.length)
      const lv = new DataView(local.buffer)
      lv.setUint32(0, 0x04034b50, true)
      lv.setUint32(18, item.bytes.length, true)
      lv.setUint32(22, item.bytes.length, true)
      lv.setUint16(26, name.length, true)
      local.set(name, 30)
      local.set(item.bytes, 30 + name.length)
      const entry = new Uint8Array(46 + name.length)
      const cv = new DataView(entry.buffer)
      cv.setUint32(0, 0x02014b50, true)
      cv.setUint32(20, item.bytes.length, true)
      cv.setUint32(24, item.bytes.length, true)
      cv.setUint16(28, name.length, true)
      cv.setUint32(42, offset, true)
      entry.set(name, 46)
      locals.push(local)
      central.push(entry)
      offset += local.byteLength
      centralSize += entry.byteLength
    }
    const end = new Uint8Array(22)
    const ev = new DataView(end.buffer)
    ev.setUint32(0, 0x06054b50, true)
    ev.setUint16(8, contents.length, true)
    ev.setUint16(10, contents.length, true)
    ev.setUint32(12, centralSize, true)
    ev.setUint32(16, offset, true)
    const archive = new Blob([...locals, ...central, end].map((bytes) => Uint8Array.from(bytes).buffer))
    const result = await previewFacebookExport(archive, "all-time-media-heavy.zip")
    expect(result).toMatchObject({ filesRead: 1, filesSkipped: 0, truncated: false })
    expect(result.samples).toHaveLength(1)
    expect(result.samples[0].at?.slice(0, 4)).toBe("2013")
    expect(result.samples[0].text).toBe("An older synthetic writing sample for the archive test.")
  })



  it("samples the entire time range of an oversized posts list without exceeding 2500 local entries", async () => {
    const posts = Array.from({ length: 6200 }, (_, i) => ({
      timestamp: Math.floor(Date.UTC(i < 3100 ? 2008 : 2025, 1, 1) / 1000),
      data: [{ post: "Synthetic authored writing index " + i + " for safe sampling." }],
    }))
    const archive = new Blob([JSON.stringify(posts)])
    const first = await previewFacebookExport(archive, "your_posts_1.json")
    const second = await previewFacebookExport(archive, "your_posts_1.json")
    expect(first.samples).toHaveLength(2500)
    expect(first.truncated).toBe(true)
    expect(first.samples).toEqual(second.samples)
    const coverage = summarizeFacebookYears(first.samples)
    expect(coverage.map((row) => row.year)).toEqual(["2025", "2008"])
    expect(coverage.every((row) => row.entries > 0)).toBe(true)
    expect(coverage.reduce((sum, row) => sum + row.entries, 0)).toBe(2500)
  })



  it("reports year-by-year sampled counts without pretending it inspected missing years", () => {
    const samples = [
      { kind: "post" as const, text: "A", source: "posts/your_posts_1.json", at: "2026-01-01T00:00:00Z" },
      { kind: "comment" as const, text: "B", source: "comments/comments.json", at: "2026-01-02T00:00:00Z" },
      { kind: "post" as const, text: "C", source: "posts/your_posts_1.json", at: "2014-12-30T00:00:00Z" },
      { kind: "comment" as const, text: "D", source: "comments/comments.json" },
    ]
    expect(summarizeFacebookYears(samples)).toEqual([
      { year: "2026", posts: 1, comments: 1, entries: 2 },
      { year: "2014", posts: 1, comments: 0, entries: 1 },
      { year: "Undated", posts: 0, comments: 1, entries: 1 },
    ])
  })



  it("skips a media-only segment in a multipart export without swallowing malformed archives", async () => {
    const mediaOnly = storedZip("messages/inbox/private/message_1.json",
      JSON.stringify([{ data: [{ post: "not owned writing" }] }]))
    const ownWriting = storedZip("posts/your_posts_1.json",
      JSON.stringify([{ data: [{ post: "A harmless synthetic owner sentence." }] }]))
    const preview = await previewFacebookExports([
      { blob: mediaOnly, name: "archive-part-1.zip" },
      { blob: ownWriting, name: "archive-part-2.zip" },
    ])
    expect(preview.samples.map((item) => item.text)).toEqual(["A harmless synthetic owner sentence."])
    expect(preview).toMatchObject({ filesRead: 1, filesSkipped: 1, truncated: true })
    await expect(previewFacebookExports([{ blob: mediaOnly, name: "only-media.zip" }]))
      .rejects.toThrow(/No supported self-authored/)
    await expect(previewFacebookExports([
      { blob: new Blob(["not a ZIP"]), name: "malformed.zip" },
      { blob: ownWriting, name: "owner.zip" },
    ])).rejects.toThrow(/ZIP archive/)
  })

  it("marks bad author JSON as incomplete, never a full coverage scan", async () => {
    const output = await previewFacebookExport(new Blob(["not json"]), "your_posts_1.json")
    expect(output).toMatchObject({ filesRead: 0, filesSkipped: 1, truncated: true })
  })

  it("rejects inconsistent uncompressed length for stored ZIP entries", async () => {
    const entryPath = "posts/your_posts_1.json"
    const body = JSON.stringify([{ data: [{ post: "Synthetic valid post." }] }])
    const archive = storedZip(entryPath, body)
    const bytes = new Uint8Array(await archive.arrayBuffer())
    const centralOffset = 30 + encoder.encode(entryPath).byteLength + encoder.encode(body).byteLength
    new DataView(bytes.buffer).setUint32(centralOffset + 24, 2, true)
    const output = await previewFacebookExport(new Blob([bytes]), "corrupted.zip")
    expect(output).toMatchObject({ samples: [], filesSkipped: 1, truncated: true })
  })



  it("parses the observed 2026 Meta comments_v2 envelope without storing author or titles", async () => {
    const fixture = {
      comments_v2: [
        { title: "Different person's post", timestamp: 1792270000, data: [
          { comment: { timestamp: 1792270000, author: "PERSONAL THIRD-PARTY FIELD", comment: "My own comment is short." } },
        ] },
      ],
    }
    const path = "your_facebook_activity/comments_and_reactions/comments.json"
    const parsed = parseOwnWritingJson(fixture, path)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].text).toBe("My own comment is short.")
    expect(JSON.stringify(parsed)).not.toContain("PERSONAL THIRD-PARTY FIELD")
    expect(JSON.stringify(parsed)).not.toContain("Different person's post")
    const preview = await previewFacebookExport(
      storedZip(path, JSON.stringify(fixture)), "facebook-owner-one-year.zip",
    )
    expect(preview).toMatchObject({ filesRead: 1, filesSkipped: 0, truncated: false })
    expect(preview.samples.map((x) => x.text)).toEqual(["My own comment is short."])
  })

  it("recognizes the observed long posts file path but extracts only authored data.post", async () => {
    const path = "your_facebook_activity/posts/your_posts__check_ins__photos_and_videos_1.json"
    const content = [{ timestamp: 1792270000, title: "PRIVATE title", attachments: [{ data: [{ text: "PRIVATE caption from media" }] }], data: [{ post: "My own original post text." }] }]
    const preview = await previewFacebookExport(storedZip(path, JSON.stringify(content)), "facebook-owner-2026.zip")
    expect(preview.samples.map((x) => x.text)).toEqual(["My own original post text."])
    expect(JSON.stringify(preview.samples)).not.toContain("PRIVATE")
  })



  it("combines year-separated owner exports without doubling identical posts", async () => {
    const current = new Blob([JSON.stringify([
      { timestamp: 1735500000, data: [{ post: "A unique recent thought from my writing." }] },
      { timestamp: 1735500000, data: [{ post: "A repeated owner thought from my writing." }] },
    ])])
    const older = new Blob([JSON.stringify([
      { timestamp: 1335500000, data: [{ post: "A unique older thought from my writing." }] },
      { timestamp: 1335500000, data: [{ post: "A repeated owner thought from my writing." }] },
    ])])
    const progress: string[] = []
    const preview = await previewFacebookExports([
      { name: "your_posts_1.json", blob: current },
      { name: "your_posts_2.json", blob: older },
    ], undefined, (label) => progress.push(label))
    expect(preview.samples).toHaveLength(3)
    expect(preview.samples.map((item) => item.at?.slice(0, 4))).toContain("2012")
    expect(preview.samples.map((item) => item.at?.slice(0, 4))).toContain("2024")
    expect(preview.filesRead).toBe(2)
    expect(progress.some((label) => label.startsWith("Archive 2/2"))).toBe(true)
  })

  it("caps multi-export input without opening untrusted archives", async () => {
    const items = Array.from({ length: 7 }, () => ({ name: "your_posts_1.json", blob: new Blob(["[]"]) }))
    await expect(previewFacebookExports(items)).rejects.toThrow(/one and six/)
  })



  it("reads bounded ZIP64 export metadata without touching private archive entries", async () => {
    const classic = storedZip("posts/your_posts_1.json", JSON.stringify([
      { data: [{ post: "This owner text is retained." }] },
    ]))
    const archive = await zip64Directory(classic)
    const result = await previewFacebookExport(archive, "fb-all-time.zip")
    expect(result.samples.map((item) => item.text)).toEqual(["This owner text is retained."])
    expect(result.filesRead).toBe(1)
  })

  it("fails on corrupt ZIP64 locators rather than guessing offsets", async () => {
    const classic = storedZip("posts/your_posts_1.json", "[]")
    const archive = new Uint8Array(await (await zip64Directory(classic)).arrayBuffer())
    archive[archive.length - 22 - 20] = 0
    await expect(previewFacebookExport(new Blob([archive]), "facebook.zip")).rejects.toThrow(/ZIP64 locator/)
  })


  it("allows self-written posts and comments but never messages, friends or reactions", () => {
    expect(classifyOwnWritingFile("your_facebook_activity/posts/your_posts_1.json")).toBe("post")
    expect(classifyOwnWritingFile("your_facebook_activity/comments_and_reactions/comments.json")).toBe("comment")
    expect(classifyOwnWritingFile("messages/inbox/partner/message_1.json")).toBeNull()
    expect(classifyOwnWritingFile("friends/friends.json")).toBeNull()
    expect(classifyOwnWritingFile("comments_and_reactions/reactions.json")).toBeNull()
    expect(classifyOwnWritingFile("your_facebook_activity/posts/posts_on_other_pages_and_profiles.json")).toBeNull()
    expect(classifyOwnWritingFile("../posts/your_posts_1.json")).toBeNull()
  })

  it("extracts authored post/comment fields but not attachment or title text", () => {
    const posts = parseOwnWritingJson([
      { timestamp: 1690000000, title: "A friend's medical data", data: [{ post: "The joke is in the timing.", attachment: "PRIVATE" }] },
      { title: "Not my own words", attachments: [{ data: { text: "not self-written" } }] },
    ], "posts/your_posts_1.json")
    expect(posts).toHaveLength(1)
    expect(posts[0].text).toBe("The joke is in the timing.")
    expect(posts[0].at).toMatch(/^2023-/)

    const comments = parseOwnWritingJson([
      { timestamp: 1690000000, data: [{ comment: { text: "That is a plot twist!" } }] },
    ], "comments_and_reactions/comments.json")
    expect(comments.map((item) => item.text)).toEqual(["That is a plot twist!"])
  })

  it("previews a ZIP locally without admitting messages or saving memory", async () => {
    const archive = storedZip("posts/your_posts_1.json", JSON.stringify([
      { data: [{ post: "The story has to make sense." }] },
    ]))
    const progress: Array<{ processed: number; total: number; phase?: "directory" }> = []
    const output = await previewFacebookExport(archive, "facebook-export.zip", undefined, (value) => progress.push(value))
    expect(progress.filter((entry) => entry.phase === "directory"))
      .toEqual([{ processed: 0, total: 1, phase: "directory" }, { processed: 1, total: 1, phase: "directory" }])
    expect(progress.filter((entry) => entry.phase !== "directory"))
      .toEqual([{ processed: 0, total: 1 }, { processed: 1, total: 1 }])
    expect(output.samples.map((sample) => sample.text)).toEqual(["The story has to make sense."])
    expect(output.filesRead).toBe(1)
    expect(writingStyleDraft(output.samples)).toContain("tentative writing observations")
  })

  it("rejects direct upload of private message JSON", async () => {
    await expect(previewFacebookExport(new Blob(["[]"]), "message_1.json"))
      .rejects.toThrow(/your_posts or comments/)
  })

  it("fails cleanly on unreadable JSON without inventing writing", async () => {
    const output = await previewFacebookExport(new Blob(["not json"]), "your_posts_1.json")
    expect(output.samples).toHaveLength(0)
    expect(output.filesSkipped).toBe(1)
  })

  it("supports a legacy status_updates container with authored text only", () => {
    const entries = parseOwnWritingJson({
      status_updates: [
        { timestamp: 1690000000, data: [{ status: "I wrote these words myself." }], title: "Shared by somebody else" },
      ],
    }, "your_facebook_activity/posts/status_updates.json")
    expect(entries).toHaveLength(1)
    expect(entries[0].text).toBe("I wrote these words myself.")
    expect(entries[0].text).not.toContain("Shared by somebody else")
  })

  it("rejects cancelled imports before reading personal content", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(previewFacebookExport(new Blob(["[]"]), "your_posts_1.json", controller.signal))
      .rejects.toThrow(/cancelled/)
  })

  it("rejects ZIPs without any allowlisted self-authored writing", async () => {
    const zip = storedZip("messages/inbox/private/message_1.json", JSON.stringify([
      { data: [{ post: "private correspondence should stay excluded" }] },
    ]))
    await expect(previewFacebookExport(zip, "export.zip"))
      .rejects.toThrow(/No supported/)
  })

  it("fails closed on inconsistent ZIP filenames", async () => {
    const zip = storedZip("posts/your_posts_1.json", JSON.stringify([
      { data: [{ post: "Only trust matching local headers" }] },
    ]))
    const corrupted = new Uint8Array(await zip.arrayBuffer())
    // The local filename begins at offset 30; central-directory name remains unchanged.
    corrupted[30] = "q".charCodeAt(0)
    const output = await previewFacebookExport(new Blob([corrupted]), "export.zip")
    expect(output).toMatchObject({ samples: [], filesSkipped: 1, truncated: true })
  })
})
