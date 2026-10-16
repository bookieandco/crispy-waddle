/**
 * Composition root.
 *
 * The one place that knows which concrete adapter backs each port and
 * wires services together. Every API route handler calls
 * `getTruckerOS()` instead of constructing repositories/services itself —
 * mirrors @jhadina/jhadina-web's `getJanetService()` singleton pattern in
 * src/lib/routes/handlers.ts.
 */

import {
  AuditService,
  DispatcherService,
  FunFinderService,
  HaversineRoutingProvider,
  InMemoryAuditRepository,
  InMemoryDriverRepository,
  InMemoryInteractionRepository,
  InMemoryMemoryRepository,
  InMemoryPlaceRepository,
  InMemoryPreferenceRepository,
  InMemoryRecommendationRepository,
  InMemorySavedPlaceRepository,
  InMemoryStore,
  MemoryService,
  OpenStreetMapProvider,
  TemplateDispatcherReasoner,
  createPlacesProvider,
  type IDispatcherReasoner,
} from "@jhadina/truckeros-core"

export interface TruckerOSContext {
  store: InMemoryStore
  driverRepo: InMemoryDriverRepository
  placeRepo: InMemoryPlaceRepository
  savedPlaceRepo: InMemorySavedPlaceRepository
  preferenceRepo: InMemoryPreferenceRepository
  interactionRepo: InMemoryInteractionRepository
  auditService: AuditService
  funFinderService: FunFinderService
  memoryService: MemoryService
  mapProvider: OpenStreetMapProvider
  dispatcherService: DispatcherService
  dispatcherReasoner: IDispatcherReasoner
}

// Next.js compiles each route.ts as its own module entry, including in dev
// mode — a plain module-scope `let context` is NOT reliably shared across
// different API route files (verified: two route files can end up with
// independent InMemoryStore instances even though both import this same
// module). Stashing on `globalThis` is the standard fix for this exact
// class of bug (the same technique Next.js's own docs recommend for a
// Prisma client singleton) and is what actually keeps one InMemoryStore
// live across every route for the life of the dev/prod server process.
declare global {
  // eslint-disable-next-line no-var
  var __truckerOSContext: TruckerOSContext | undefined
}

export function getTruckerOS(): TruckerOSContext {
  if (globalThis.__truckerOSContext) return globalThis.__truckerOSContext

  const store = new InMemoryStore()
  const driverRepo = new InMemoryDriverRepository(store)
  const placeRepo = new InMemoryPlaceRepository(store)
  const savedPlaceRepo = new InMemorySavedPlaceRepository(store)
  const preferenceRepo = new InMemoryPreferenceRepository(store)
  const recommendationRepo = new InMemoryRecommendationRepository(store)
  const interactionRepo = new InMemoryInteractionRepository(store)
  const memoryRepo = new InMemoryMemoryRepository(store)
  const auditRepo = new InMemoryAuditRepository(store)

  const auditService = new AuditService(auditRepo)
  const memoryService = new MemoryService(memoryRepo, preferenceRepo, auditService)

  const placesProvider = createPlacesProvider(process.env.GOOGLE_MAPS_API_KEY)
  const routingProvider = new HaversineRoutingProvider()
  const funFinderService = new FunFinderService(
    placesProvider,
    routingProvider,
    placeRepo,
    preferenceRepo,
    recommendationRepo,
    auditService
  )

  const context: TruckerOSContext = {
    store,
    driverRepo,
    placeRepo,
    savedPlaceRepo,
    preferenceRepo,
    interactionRepo,
    auditService,
    funFinderService,
    memoryService,
    mapProvider: new OpenStreetMapProvider(),
    dispatcherService: new DispatcherService(),
    // Template-based stand-in — see TemplateDispatcherReasoner.ts. Swapping
    // in a real LLM-backed adapter later is a one-line change here; nothing
    // above this composition root needs to know which one is wired in.
    dispatcherReasoner: new TemplateDispatcherReasoner(),
  }
  globalThis.__truckerOSContext = context
  return context
}
