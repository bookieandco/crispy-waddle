import type { PlaceCategorySlug, TruckAttributes } from "../types.js";

export interface PlaceSearchParams {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  category: PlaceCategorySlug;
}

/**
 * What a places search returns before TruckerOS has assigned it a local id,
 * cached it, or ranked it. `providerName` travels with every result so
 * nothing downstream can lose track of whether data came from a real API
 * or the offline mock.
 */
export interface PlaceSearchResult {
  providerId: string;
  providerName: string;
  name: string;
  category: PlaceCategorySlug;
  latitude: number;
  longitude: number;
  address: string | null;
  phone: string | null;
  rating: number | null;
  isOpenNow: boolean | null;
  truckAttributes: TruckAttributes;
}

/**
 * Port for the places/search backend FunFinder queries. Swap the concrete
 * adapter (Google Places, another provider, or the offline mock) without
 * touching FunFinderService.
 */
export interface IPlacesProvider {
  readonly providerName: string;
  searchNearby(params: PlaceSearchParams): Promise<PlaceSearchResult[]>;
}
