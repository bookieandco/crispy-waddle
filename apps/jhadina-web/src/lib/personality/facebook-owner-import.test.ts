import { describe, expect, it } from "vitest"
import {
  classifyOwnWritingFile, parseOwnWritingJson, previewFacebookExport, writingStyleDraft,
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

describe("owner-scoped Facebook export writing preview", () => {
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
    const output = await previewFacebookExport(archive, "facebook-export.zip")
    expect(output.samples.map((sample) => sample.text)).toEqual(["The story has to make sense."])
    expect(output.filesRead).toBe(1)
    expect(writingStyleDraft(output.samples)).toContain("tentative writing observations")
  })

  it("reports import progress and supports cancellation without persistence", async () => {
    const archive = storedZip("posts/your_posts_1.json", JSON.stringify([
      { data: [{ post: "Some public writing for the preview." }] },
    ]))
    const progress: Array<{ completed: number; total: number }> = []
    const result = await previewFacebookExport(archive, "facebook-export.zip", {
      onProgress: (entry) => progress.push(entry),
    })
    expect(result.samples).toHaveLength(1)
    expect(progress).toEqual([{ completed: 0, total: 1 }, { completed: 1, total: 1 }])

    const controller = new AbortController()
    controller.abort()
    await expect(previewFacebookExport(archive, "facebook-export.zip", { signal: controller.signal }))
      .rejects.toThrow(/cancelled/)
  })

  it("treats corrupt supported JSON inside a ZIP as a partial import, not approved evidence", async () => {
    const result = await previewFacebookExport(storedZip("posts/your_posts.json", "invalid json"), "fb.zip")
    expect(result.samples).toEqual([])
    expect(result.filesRead).toBe(0)
    expect(result.filesSkipped).toBe(1)
    expect(result.truncated).toBe(true)
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
})
