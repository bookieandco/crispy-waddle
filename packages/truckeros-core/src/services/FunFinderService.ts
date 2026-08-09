import type { IPlacesProvider } from "../interfaces/places.js";
import type { IRoutingProvider } from "../interfaces/routing.js";
import type { PlaceRepository } from "../repositories/PlaceRepository.js";
import type { PreferenceRepository } from "../repositories/PreferenceRepository.js";
import type { RecommendationRepository } from "../repositories/RecommendationRepository.js";
import type { AuditService } from "./AuditService.js";
import type { Place, PlaceCategorySlug, RankedPlace } from "../types.js";
import { resolveTruckAttribute } from "../types.js";

export interface FunFinderSearchParams {
  driverId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  category: PlaceCategorySlug | "all";
  requireTruckParking?: boolean;
}

/** Used for the Driver Home "closest mixed recommendations" list (category = "all"). */
const DEFAULT_MIX_CATEGORIES: PlaceCategorySlug[] = ["food", "bbq", "truck_stops", "attractions"];

/**
 * Search pipeline:
 *
 *   GPS -> radius -> places provider -> truck-aware filter -> distance ->
 *   driver preference weighting -> ranked results
 *
 * Deliberately not a "recommendation engine": the ranking formula is one
 * readable function (see rank()) that anyone can audit by reading it, not
 * a model. Every result's rankReasons explain why it landed where it did.
 */
export class FunFinderService {
  constructor(
    private readonly placesProvider: IPlacesProvider,
    private readonly routingProvider: IRoutingProvider,
    private readonly placeRepo: PlaceRepository,
    private readonly preferenceRepo: PreferenceRepository,
    private readonly recommendationRepo: RecommendationRepository,
    private readonly auditService: AuditService
  ) {}

  async search(params: FunFinderSearchParams): Promise<RankedPlace[]> {
    const categories = params.category === "all" ? DEFAULT_MIX_CATEGORIES : [params.category];
    const origin = { latitude: params.latitude, longitude: params.longitude };

    const searchResults = (
      await Promise.all(
        categories.map((category) =>
          this.placesProvider.searchNearby({
            latitude: params.latitude,
            longitude: params.longitude,
            radiusMeters: params.radiusMeters,
            category,
          })
        )
      )
    ).flat();

    const preferences = await this.preferenceRepo.listByDriver(params.driverId);

    const ranked: RankedPlace[] = [];
    for (const result of searchResults) {
      const place = await this.placeRepo.upsert(result);
      const route = await this.routingProvider.estimateRoute(origin, {
        latitude: place.latitude,
        longitude: place.longitude,
      });

      const { score, reasons } = rank(place, route.distanceMeters, preferences);

      ranked.push({
        ...place,
        distanceMeters: route.distanceMeters,
        etaMinutes: route.etaMinutes,
        routeMethod: route.method,
        rankScore: score,
        rankReasons: reasons,
      });
    }

    let results = ranked;
    if (params.requireTruckParking) {
      results = results.filter((place) => {
        const parking = resolveTruckAttribute(place.truckAttributes, "large_vehicle_parking");
        const accessible = resolveTruckAttribute(place.truckAttributes, "truck_accessible");
        return parking.value === true || accessible.value === true;
      });
    }

    results.sort((a, b) => b.rankScore - a.rankScore || a.distanceMeters - b.distanceMeters);

    for (const place of results) {
      await this.recommendationRepo.record({
        driverId: params.driverId,
        placeId: place.id,
        runContext: {
          latitude: params.latitude,
          longitude: params.longitude,
          radiusMeters: params.radiusMeters,
          category: params.category,
          rankScore: place.rankScore,
        },
      });
    }

    await this.auditService.record({
      actorType: "api_gateway",
      actorId: params.driverId,
      eventName: "funfinder.search_executed",
      payload: {
        latitude: params.latitude,
        longitude: params.longitude,
        radiusMeters: params.radiusMeters,
        category: params.category,
        requireTruckParking: params.requireTruckParking ?? false,
        resultCount: results.length,
        preferencesApplied: preferences.length,
        provider: this.placesProvider.providerName,
        topResult: results[0]?.name ?? null,
      },
      triggeredBy: "driver_action:funfinder_search",
      driverApproved: null,
    });

    return results;
  }
}

function rank(
  place: Place,
  distanceMeters: number,
  preferences: { key: string; value: string; weight: number }[]
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Proximity: closer places score higher, tapering off past ~15 miles.
  const miles = distanceMeters / 1609.344;
  const proximityScore = Math.max(0, 30 - miles * 2);
  score += proximityScore;
  reasons.push(`+${proximityScore.toFixed(1)} proximity (${miles.toFixed(1)} mi)`);

  if (place.rating != null) {
    const ratingScore = place.rating * 2;
    score += ratingScore;
    reasons.push(`+${ratingScore.toFixed(1)} rating (${place.rating})`);
  }

  // Plain "I like this category" preference — applies regardless of parking.
  const categoryPreference = preferences.find(
    (p) => p.key === "preferred_category" && p.value === place.category
  );
  if (categoryPreference) {
    const bonus = categoryPreference.weight * 4;
    score += bonus;
    reasons.push(`+${bonus} approved preference match ("preferred_category: ${categoryPreference.value}")`);
  }

  // "I like this category WHEN it has truck parking" — only pays out when
  // both halves of that preference are true for this place. A category
  // match alone should not silently unlock the parking bonus, or a saved
  // preference for parking-required BBQ would boost every BBQ joint
  // whether or not it actually has parking.
  const parkingPreference = preferences.find(
    (p) => p.key === "preferred_category_with_parking" && p.value === place.category
  );
  if (parkingPreference) {
    const parking = resolveTruckAttribute(place.truckAttributes, "large_vehicle_parking");
    const accessible = resolveTruckAttribute(place.truckAttributes, "truck_accessible");
    const hasParking = parking.value === true || accessible.value === true;
    if (hasParking) {
      const verifiedSource = parking.source === "provider_verified" || accessible.source === "provider_verified";
      const sourceBonus = verifiedSource ? 10 : 5;
      const bonus = parkingPreference.weight * 6 + sourceBonus;
      score += bonus;
      const source = parking.value === true ? parking.source : accessible.source;
      reasons.push(`+${bonus} approved preference match with confirmed truck parking (${source})`);
    }
  }

  return { score: Math.round(score * 10) / 10, reasons };
}
