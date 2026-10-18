import { describe, expect, it } from "vitest"
import {
  classifyOwnWritingFile, parseOwnWritingJson, previewFacebookExport, previewFacebookExports, summarizeFacebookYears, writingStyleDraft,
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
    const archive = new Blob([...locals, ...central, end])
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
    const progress: Array<{ processed: number; total: number }> = []
    const output = await previewFacebookExport(archive, "facebook-export.zip", undefined, (value) => progress.push(value))
    expect(progress).toEqual([{ processed: 0, total: 1 }, { processed: 1, total: 1 }])
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
