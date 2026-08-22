import { describe, expect, it } from "vitest"
import { NextRequest } from "next/server"
import {
  handleApproveMemoryCandidate,
  handleFunFinderSearch,
  handleGetDriver,
  handleListAudit,
  handleListMemories,
  handleListMemoryCandidates,
  handlePostDispatcher,
  handlePostInteraction,
} from "./handlers"

const DALLAS = { lat: "32.7767", lng: "-96.797" }

const sampleLoad = (overrides: Record<string, unknown> = {}) => ({
  id: "load-1",
  origin: "Houston, TX",
  destination: "Dallas, TX",
  pickupAt: null,
  deliveryAt: null,
  revenueCents: 210_000,
  loadedMiles: 240,
  deadheadMiles: 40,
  fuelCostCents: 31_000,
  tollCostCents: 4_800,
  otherCostCents: 7_500,
  brokerName: "Example Broker",
  ...overrides,
})

function dispatcherRequest(body: unknown) {
  return new NextRequest("http://localhost/api/dispatcher", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

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

describe("route handlers — POST /api/dispatcher", () => {
  it("rejects a missing message", async () => {
    const res = await handlePostDispatcher(
      dispatcherRequest({ context: { loads: [sampleLoad()], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 } })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/message/)
  })

  it("rejects an empty loads array", async () => {
    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Should I take this load?",
        context: { loads: [], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/context\.loads/)
  })

  it("rejects a load missing a required numeric field, naming the exact field", async () => {
    const badLoad = sampleLoad()
    delete (badLoad as Record<string, unknown>).revenueCents
    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Should I take this load?",
        context: { loads: [badLoad], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe("context.loads[0].revenueCents is required and must be a finite number")
  })

  it("rejects an inverted threshold pair (target below minimum) rather than silently misranking", async () => {
    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Should I take this load?",
        context: { loads: [sampleLoad()], minimumNetCentsPerMile: 500, targetNetCentsPerMile: 400 },
      })
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/targetNetCentsPerMile.*minimumNetCentsPerMile/)
  })

  it("rejects malformed JSON with a 400, not a 500", async () => {
    const req = new NextRequest("http://localhost/api/dispatcher", { method: "POST", body: "{not json" })
    const res = await handlePostDispatcher(req)
    expect(res.status).toBe(400)
  })

  it("returns a ranked brief, an explanation, and an explicit safety block with no execution capability", async () => {
    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Should I take the Houston to Dallas load?",
        context: { loads: [sampleLoad()], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.success).toBe(true)
    expect(json.data.brief.recommendation).toBe("accept")
    expect(json.data.brief.candidates).toHaveLength(1)
    expect(typeof json.data.explanation).toBe("string")
    expect(json.data.explanation.length).toBeGreaterThan(0)

    // The safety boundary is asserted on the wire, not just in comments:
    // advisory only, deterministic economics, nothing executable.
    expect(json.data.safety).toEqual({
      aiRole: "advisory",
      economicsSource: "deterministic",
      executionAllowed: false,
      requiresDriverApproval: true,
    })

    // No field anywhere in the payload offers a way to actually commit to
    // anything — this is a recommendation, not a booking action.
    const serialized = JSON.stringify(json.data).toLowerCase()
    for (const forbidden of ["\"execute\"", "\"book\"", "\"commit\"", "\"confirmbooking\""]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it("never lets the AI narrative introduce a dollar figure absent from the deterministic brief", async () => {
    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Why should I take this one?",
        context: { loads: [sampleLoad()], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )
    const json = await res.json()

    const dollarAmounts: string[] = json.data.explanation.match(/\$\d+(\.\d+)?/g) ?? []
    const sourceText = `${json.data.brief.headline} ${json.data.brief.candidates
      .flatMap((c: { reasons: string[] }) => c.reasons)
      .join(" ")}`
    for (const amount of dollarAmounts) {
      expect(sourceText).toContain(amount)
    }
  })

  it("records an audit event for every dispatcher query, advisory (driverApproved: null)", async () => {
    await handlePostDispatcher(
      dispatcherRequest({
        message: "Audit trail check",
        context: { loads: [sampleLoad()], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )

    const auditRes = await handleListAudit(new NextRequest("http://localhost/api/audit?limit=50"))
    const auditJson = await auditRes.json()
    const event = auditJson.data.events.find(
      (e: { eventName: string; payload: { message?: string } }) =>
        e.eventName === "dispatcher.brief_requested" && e.payload.message === "Audit trail check"
    )
    expect(event).toBeDefined()
    expect(event.driverApproved).toBeNull()
    expect(event.triggeredBy).toBe("driver_action:dispatcher_query")
  })

  it("ranks a stronger load first and declines a load below the driver's minimum", async () => {
    const strong = sampleLoad({ id: "strong", revenueCents: 220_000 })
    const belowMinimum = sampleLoad({ id: "weak", revenueCents: 80_000 })

    const res = await handlePostDispatcher(
      dispatcherRequest({
        message: "Which of these should I take?",
        context: { loads: [belowMinimum, strong], minimumNetCentsPerMile: 400, targetNetCentsPerMile: 500 },
      })
    )
    const json = await res.json()

    expect(json.data.brief.candidates.map((c: { load: { id: string } }) => c.load.id)).toEqual(["strong", "weak"])
    expect(json.data.brief.recommendation).toBe("accept")

    const weakCandidate = json.data.brief.candidates.find((c: { load: { id: string } }) => c.load.id === "weak")
    expect(weakCandidate.recommendation).toBe("decline")
  })
})
