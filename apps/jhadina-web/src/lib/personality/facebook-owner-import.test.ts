import { describe, expect, it } from "vitest"
import {
  classifyOwnWritingFile, parseOwnWritingJson, previewFacebookExport, previewFacebookExports, writingStyleDraft,
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
