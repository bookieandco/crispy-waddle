import { describe, expect, it, vi } from "vitest"
import { discoverRemoteOkAiJobs } from "./remoteok-client"

describe("Remote OK discovery client", () => {
  it("filters the public feed to AI jobs and preserves feed attribution", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([
      { last_updated: 123, legal: "Credit Remote OK and link back." },
      {
        id: "1",
        company: "AI Co",
        position: "Machine Learning Engineer",
        tags: ["python", "machine learning"],
        url: "https://remoteok.com/remote-jobs/ml-1",
      },
      {
        id: "2",
        company: "Finance Co",
        position: "Accountant",
        tags: ["finance"],
        url: "https://remoteok.com/remote-jobs/accountant-2",
      },
    ]), { status: 200, headers: { "content-type": "application/json" } }))

    const result = await discoverRemoteOkAiJobs({ tag: "ai", limit: 10 }, fetcher as typeof fetch)

    expect(result.source).toBe("Remote OK")
    expect(result.attributionRequired).toBe(true)
    expect(result.jobs.map((job) => job.id)).toEqual(["1"])
    expect(fetcher).toHaveBeenCalledWith(
      "https://remoteok.com/api?tag=ai",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    )
  })

  it("rejects unsafe tag input before making a request", async () => {
    const fetcher = vi.fn()
    await expect(discoverRemoteOkAiJobs({ tag: "ai&evil=true" }, fetcher as typeof fetch)).rejects.toThrow("tag is invalid")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("fails closed on provider errors", async () => {
    const fetcher = vi.fn(async () => new Response("nope", { status: 503 }))
    await expect(discoverRemoteOkAiJobs({}, fetcher as typeof fetch)).rejects.toThrow("HTTP 503")
  })
})
