/**
 * Composition root.
 *
 * The one place that knows which concrete adapter backs each port and
 * wires services together. Every API route handler calls
 * `getTruckerOS()` instead of constructing repositories/services itself.
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
  MockLoadProvider,
  OpenStreetMapProvider,
  TemplateDispatcherReasoner,
  createPlacesProvider,
  type IDispatcherReasoner,
  type ILoadProvider,
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
  loadProvider: ILoadProvider
}

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
    dispatcherReasoner: new TemplateDispatcherReasoner(),
    // Explicitly offline until a real load-board adapter is verified.
    loadProvider: new MockLoadProvider(),
  }
  globalThis.__truckerOSContext = context
  return context
}
