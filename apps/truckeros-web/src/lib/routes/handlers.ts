/**
 * Route Handlers: API Layer
 *
 * Bridges HTTP requests to the TruckerOS services. UI components never
 * import a repository or service directly — every screen calls one of
 * these routes, which call services, which call repositories. See
 * apps/truckeros-web/src/lib/composition.ts for how those are wired.
 *
 * Routes:
 *   GET    /api/driver                          - Get (and lazily seed) the demo driver
 *   POST   /api/location                         - Record a GPS ping, update driver position
 *   GET    /api/funfinder/search                 - Ranked nearby places
 *   GET    /api/places/:id                        - Place detail
 *   POST   /api/interactions                      - Record viewed/navigated/saved/dismissed/liked/disliked
 *   GET    /api/saved-places                       - List saved places (with place data joined)
 *   GET    /api/memory/candidates                  - List pending memory candidates
 *   POST   /api/memory/candidates/:id/approve       - Approve a candidate -> Memory + Preference
 *   POST   /api/memory/candidates/:id/reject        - Reject a candidate
 *   GET    /api/memory                              - List committed memories
 *   GET    /api/audit                                - Recent audit ledger entries
 *   POST   /api/dispatcher                            - Ranked load recommendations + AI explanation (advisory only)
 *   GET    /api/health                                - Health check
 *
 * There is no auth yet (MVP has exactly one driver). Every handler resolves
 * to that seeded driver via driverRepo.getOrCreateDemoDriver().
 */

import { NextRequest, NextResponse } from "next/server"
import {
  isPlaceCategorySlug,
  type DispatcherContext,
  type InteractionEventType,
  type LoadOffer,
  type PlaceCategorySlug,
} from "@jhadina/truckeros-core"
import { getTruckerOS } from "../composition"

function errorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : "Unknown error"
  console.error(`[truckeros-web] ${message}`)
  return NextResponse.json({ success: false, error: message }, { status })
}

// ═══════════════════════════════════════════════════════════════
// GET /api/driver
// ═══════════════════════════════════════════════════════════════

export async function handleGetDriver() {
  try {
    const { driverRepo } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    return NextResponse.json({ success: true, data: { driver } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/location
// ═══════════════════════════════════════════════════════════════

export async function handlePostLocation(req: NextRequest) {
  try {
    const body = await req.json()
    const { latitude, longitude, accuracy, heading, speed } = body

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "latitude and longitude are required numbers" },
        { status: 400 }
      )
    }

    const { driverRepo, store, auditService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const updated = await driverRepo.updateCurrentLocation(driver.id, { latitude, longitude })

    store.locations.push({
      driverId: driver.id,
      latitude,
      longitude,
      accuracy: typeof accuracy === "number" ? accuracy : null,
      heading: typeof heading === "number" ? heading : null,
      speed: typeof speed === "number" ? speed : null,
      recordedAt: new Date().toISOString(),
    })

    await auditService.record({
      actorType: "driver",
      actorId: driver.id,
      eventName: "location.updated",
      payload: { latitude, longitude, accuracy: accuracy ?? null },
      triggeredBy: "device_action:gps_fix",
      driverApproved: null,
    })

    return NextResponse.json({ success: true, data: { driver: updated } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/funfinder/search
// ═══════════════════════════════════════════════════════════════

export async function handleFunFinderSearch(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawLat = searchParams.get("lat")
    const rawLng = searchParams.get("lng")
    const latitude = Number(rawLat)
    const longitude = Number(rawLng)

    // Number(null) is 0, not NaN — so an absent lat/lng must be checked for
    // presence explicitly, not inferred from Number.isFinite alone.
    if (!rawLat || !rawLng || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json(
        { success: false, error: "lat and lng query parameters are required" },
        { status: 400 }
      )
    }

    const rawCategory = searchParams.get("category") ?? "all"
    const category: PlaceCategorySlug | "all" =
      rawCategory === "all" || isPlaceCategorySlug(rawCategory) ? rawCategory : "all"

    const radiusMeters = Number(searchParams.get("radiusMeters")) || 16093 // ~10mi default
    const requireTruckParking = searchParams.get("requireTruckParking") === "true"

    const { driverRepo, funFinderService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()

    const results = await funFinderService.search({
      driverId: driver.id,
      latitude,
      longitude,
      radiusMeters,
      category,
      requireTruckParking,
    })

    return NextResponse.json({ success: true, data: { results, count: results.length } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/places/:id
// ═══════════════════════════════════════════════════════════════

export async function handleGetPlace(_req: NextRequest, placeId: string) {
  try {
    const { placeRepo } = getTruckerOS()
    const place = await placeRepo.getById(placeId)
    if (!place) {
      return NextResponse.json({ success: false, error: `Place not found: ${placeId}` }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: { place } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/interactions
// ═══════════════════════════════════════════════════════════════

const VALID_EVENT_TYPES: InteractionEventType[] = [
  "viewed",
  "navigated",
  "saved",
  "dismissed",
  "liked",
  "disliked",
]

export async function handlePostInteraction(req: NextRequest) {
  try {
    const body = await req.json()
    const { placeId, recommendationId, eventType, notes } = body as {
      placeId?: string
      recommendationId?: string
      eventType?: string
      notes?: string
    }

    if (!placeId || typeof placeId !== "string") {
      return NextResponse.json({ success: false, error: "placeId is required" }, { status: 400 })
    }
    if (!eventType || !VALID_EVENT_TYPES.includes(eventType as InteractionEventType)) {
      return NextResponse.json(
        { success: false, error: `eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}` },
        { status: 400 }
      )
    }

    const { driverRepo, placeRepo, savedPlaceRepo, interactionRepo, memoryService, auditService } =
      getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const place = await placeRepo.getById(placeId)
    if (!place) {
      return NextResponse.json({ success: false, error: `Place not found: ${placeId}` }, { status: 404 })
    }

    const interaction = await interactionRepo.record({
      driverId: driver.id,
      placeId,
      recommendationId: recommendationId ?? null,
      eventType: eventType as InteractionEventType,
      notes: notes ?? null,
    })

    if (eventType === "saved") {
      await savedPlaceRepo.save(driver.id, placeId)
    }

    await auditService.record({
      actorType: "driver",
      actorId: driver.id,
      eventName: "interaction.recorded",
      payload: { interactionId: interaction.id, placeId, placeName: place.name, eventType, notes: notes ?? null },
      triggeredBy: `driver_action:${eventType}`,
      driverApproved: null,
    })

    // Memory Core: a positive signal (saved/liked) may propose a candidate.
    // The candidate is NOT a preference yet — it only becomes one if the
    // driver approves it from /activity.
    const candidate = await memoryService.proposeFromInteraction({
      driverId: driver.id,
      place,
      eventType: eventType as InteractionEventType,
    })

    return NextResponse.json({
      success: true,
      data: { interaction, memoryCandidate: candidate },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/saved-places
// ═══════════════════════════════════════════════════════════════

export async function handleListSavedPlaces() {
  try {
    const { driverRepo, savedPlaceRepo, placeRepo } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const saved = await savedPlaceRepo.listByDriver(driver.id)
    const withPlaces = await Promise.all(
      saved.map(async (s) => ({ ...s, place: await placeRepo.getById(s.placeId) }))
    )
    return NextResponse.json({ success: true, data: { savedPlaces: withPlaces } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/memory/candidates
// ═══════════════════════════════════════════════════════════════

export async function handleListMemoryCandidates() {
  try {
    const { driverRepo, memoryService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const candidates = await memoryService.listPendingCandidates(driver.id)
    return NextResponse.json({ success: true, data: { candidates, count: candidates.length } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/memory/candidates/:id/approve
// ═══════════════════════════════════════════════════════════════

export async function handleApproveMemoryCandidate(_req: NextRequest, candidateId: string) {
  try {
    const { driverRepo, memoryService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const memory = await memoryService.approve(driver.id, candidateId)
    return NextResponse.json({ success: true, data: { memory } })
  } catch (error) {
    return errorResponse(error, 400)
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/memory/candidates/:id/reject
// ═══════════════════════════════════════════════════════════════

export async function handleRejectMemoryCandidate(_req: NextRequest, candidateId: string) {
  try {
    const { driverRepo, memoryService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const candidate = await memoryService.reject(driver.id, candidateId)
    return NextResponse.json({ success: true, data: { candidate } })
  } catch (error) {
    return errorResponse(error, 400)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/memory
// ═══════════════════════════════════════════════════════════════

export async function handleListMemories() {
  try {
    const { driverRepo, memoryService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()
    const memories = await memoryService.listMemories(driver.id)
    return NextResponse.json({ success: true, data: { memories, count: memories.length } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/audit
// ═══════════════════════════════════════════════════════════════

export async function handleListAudit(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get("limit")) || 50
    const { auditService } = getTruckerOS()
    const events = await auditService.listRecent(limit)
    return NextResponse.json({ success: true, data: { events, count: events.length } })
  } catch (error) {
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/dispatcher
//
// Safety boundary (see packages/truckeros-core/src/interfaces/dispatcher.ts):
//   - The request body's `context` (loads + thresholds) is the ONLY input
//     to the economics. DispatcherService computes recommendations from it
//     deterministically; nothing here lets the driver's free-text message
//     or the AI reasoner change a number.
//   - The reasoner (IDispatcherReasoner) only narrates the already-computed
//     DispatcherBrief. It cannot alter `brief` — it receives it by value
//     and returns a string.
//   - The response has no "execute"/"book"/"commit" action. It's a
//     recommendation the driver reviews; nothing here can complete an
//     external commitment on its own. The response's own `safety` block
//     makes that boundary a checkable part of the contract, not just
//     prose — see handlers.test.ts.
// ═══════════════════════════════════════════════════════════════

const MAX_MESSAGE_LENGTH = 2000
const MAX_LOADS = 25

class DispatcherValidationError extends Error {}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DispatcherValidationError(`${field} is required and must be a non-empty string`)
  }
  return value
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") {
    throw new DispatcherValidationError(`${field} must be a string or null`)
  }
  return value
}

function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DispatcherValidationError(`${field} is required and must be a finite number`)
  }
  return value
}

function parseLoadOffer(raw: unknown, index: number): LoadOffer {
  if (typeof raw !== "object" || raw === null) {
    throw new DispatcherValidationError(`context.loads[${index}] must be an object`)
  }
  const load = raw as Record<string, unknown>
  const at = (field: string) => `context.loads[${index}].${field}`

  return {
    id: requireString(load.id, at("id")),
    origin: requireString(load.origin, at("origin")),
    destination: requireString(load.destination, at("destination")),
    pickupAt: requireNullableString(load.pickupAt, at("pickupAt")),
    deliveryAt: requireNullableString(load.deliveryAt, at("deliveryAt")),
    revenueCents: requireFiniteNumber(load.revenueCents, at("revenueCents")),
    loadedMiles: requireFiniteNumber(load.loadedMiles, at("loadedMiles")),
    deadheadMiles: requireFiniteNumber(load.deadheadMiles, at("deadheadMiles")),
    fuelCostCents: requireFiniteNumber(load.fuelCostCents, at("fuelCostCents")),
    tollCostCents: requireFiniteNumber(load.tollCostCents, at("tollCostCents")),
    otherCostCents: requireFiniteNumber(load.otherCostCents, at("otherCostCents")),
    brokerName: requireNullableString(load.brokerName, at("brokerName")),
  }
}

export async function handlePostDispatcher(req: NextRequest) {
  try {
    const body = await req.json().catch(() => {
      throw new DispatcherValidationError("Request body must be valid JSON")
    })

    const message = requireString(body?.message, "message")
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new DispatcherValidationError(`message must be ${MAX_MESSAGE_LENGTH} characters or fewer`)
    }

    const rawContext = body?.context
    if (typeof rawContext !== "object" || rawContext === null) {
      throw new DispatcherValidationError("context is required and must be an object")
    }

    const rawLoads = rawContext.loads
    if (!Array.isArray(rawLoads) || rawLoads.length === 0) {
      throw new DispatcherValidationError("context.loads is required and must be a non-empty array")
    }
    if (rawLoads.length > MAX_LOADS) {
      throw new DispatcherValidationError(`context.loads must contain ${MAX_LOADS} or fewer loads`)
    }
    const loads = rawLoads.map((raw, index) => parseLoadOffer(raw, index))

    const minimumNetCentsPerMile = requireFiniteNumber(
      rawContext.minimumNetCentsPerMile,
      "context.minimumNetCentsPerMile"
    )
    const targetNetCentsPerMile = requireFiniteNumber(
      rawContext.targetNetCentsPerMile,
      "context.targetNetCentsPerMile"
    )
    if (targetNetCentsPerMile < minimumNetCentsPerMile) {
      // DispatcherService checks "meets target" before "clears minimum";
      // an inverted threshold pair would let a load that hasn't cleared
      // the driver's own minimum come back as "accept". Reject the
      // request rather than silently producing a recommendation that
      // undercuts the driver's own floor.
      throw new DispatcherValidationError(
        "context.targetNetCentsPerMile must be greater than or equal to context.minimumNetCentsPerMile"
      )
    }

    const { driverRepo, dispatcherService, dispatcherReasoner, auditService } = getTruckerOS()
    const driver = await driverRepo.getOrCreateDemoDriver()

    const dispatcherContext: DispatcherContext = {
      driver,
      currentLocation: driver.currentLocation,
      loads,
      minimumNetCentsPerMile,
      targetNetCentsPerMile,
    }

    const brief = dispatcherService.brief(dispatcherContext)
    const explanation = await dispatcherReasoner.explain(brief, message)

    await auditService.record({
      actorType: "api_gateway",
      actorId: driver.id,
      eventName: "dispatcher.brief_requested",
      payload: {
        message,
        loadCount: loads.length,
        recommendation: brief.recommendation,
        topLoadId: brief.candidates[0]?.load.id ?? null,
        minimumNetCentsPerMile,
        targetNetCentsPerMile,
      },
      triggeredBy: "driver_action:dispatcher_query",
      driverApproved: null,
    })

    return NextResponse.json({
      success: true,
      data: {
        brief,
        explanation,
        safety: {
          aiRole: "advisory",
          economicsSource: "deterministic",
          executionAllowed: false,
          requiresDriverApproval: true,
        },
      },
    })
  } catch (error) {
    if (error instanceof DispatcherValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return errorResponse(error)
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/health
// ═══════════════════════════════════════════════════════════════

export async function handleHealth() {
  try {
    getTruckerOS()
    return NextResponse.json({ success: true, status: "ok", timestamp: new Date().toISOString() })
  } catch (error) {
    return errorResponse(error)
  }
}
