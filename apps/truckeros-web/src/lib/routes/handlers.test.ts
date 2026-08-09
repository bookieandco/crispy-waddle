import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  handleApproveMemoryCandidate,
  handleFunFinderSearch,
  handleGetDriver,
  handleListMemories,
  handleListMemoryCandidates,
  handlePostInteraction,
} from "./handlers"

const DALLAS = { lat: "32.7767", lng: "-96.797" }

describe("route handlers — acceptance loop", () => {
  it("GET /api/driver seeds and returns the demo driver", async () => {
    const res = await handleGetDriver()
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.driver.name).toBe("Dorian")
  })

  it("GET /api/funfinder/search rejects missing coordinates", async () => {
    const res = await handleFunFinderSearch(new NextRequest("http://localhost/api/funfinder/search"))
    expect(res.status).toBe(400)
  })

  it("POST /api/interactions rejects an unknown eventType", async () => {
    const req = new NextRequest("http://localhost/api/interactions", {
      method: "POST",
      body: JSON.stringify({ placeId: "does_not_matter", eventType: "bogus" }),
    })
    const res = await handlePostInteraction(req)
    expect(res.status).toBe(400)
  })

  it("runs the full loop: search -> save -> memory candidate -> approve -> influences a later search", async () => {
    // 1. FunFinder search for BBQ near Dallas.
    const searchReq = new NextRequest(
      `http://localhost/api/funfinder/search?lat=${DALLAS.lat}&lng=${DALLAS.lng}&category=bbq`
    )
    const searchRes = await handleFunFinderSearch(searchReq)
    const searchJson = await searchRes.json()
    expect(searchJson.success).toBe(true)
    expect(searchJson.data.results.length).toBeGreaterThan(0)

    const firstPlace = searchJson.data.results[0]

    // 2. Driver saves it -> records interaction + proposes a memory candidate.
    const saveReq = new NextRequest("http://localhost/api/interactions", {
      method: "POST",
      body: JSON.stringify({ placeId: firstPlace.id, eventType: "saved" }),
    })
    const saveRes = await handlePostInteraction(saveReq)
    const saveJson = await saveRes.json()
    expect(saveJson.success).toBe(true)
    expect(saveJson.data.interaction.eventType).toBe("saved")

    // 3. The candidate shows up pending approval.
    const candidatesRes = await handleListMemoryCandidates()
    const candidatesJson = await candidatesRes.json()
    expect(candidatesJson.data.candidates.length).toBeGreaterThan(0)
    const candidate = candidatesJson.data.candidates[0]
    expect(candidate.status).toBe("pending")

    // 4. Driver approves it from /activity.
    const approveRes = await handleApproveMemoryCandidate(
      new NextRequest("http://localhost/api/memory/candidates/x/approve", { method: "POST" }),
      candidate.id
    )
    expect(approveRes.status).toBe(200)

    // 5. It's now a committed memory, visible on /profile.
    const memoriesRes = await handleListMemories()
    const memoriesJson = await memoriesRes.json()
    expect(memoriesJson.data.memories.some((m: { memoryCandidateId: string }) => m.memoryCandidateId === candidate.id)).toBe(
      true
    )

    // 6. Re-running the same search reflects the newly approved preference
    // in at least one result's rank reasons.
    const secondSearchRes = await handleFunFinderSearch(searchReq)
    const secondSearchJson = await secondSearchRes.json()
    const influenced = secondSearchJson.data.results.some((p: { rankReasons: string[] }) =>
      p.rankReasons.some((reason) => reason.includes("approved preference match"))
    )
    expect(influenced).toBe(true)
  })
})
