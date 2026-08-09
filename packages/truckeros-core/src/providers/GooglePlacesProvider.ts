import type { IPlacesProvider, PlaceSearchParams, PlaceSearchResult } from "../interfaces/places.js";
import type { TruckAttributes } from "../types.js";
import { emptyTruckAttributes } from "../types.js";

const CATEGORY_QUERY_TEXT: Record<string, string> = {
  food: "restaurants",
  bbq: "BBQ restaurant",
  nightlife: "bars and nightlife",
  live_music: "live music venue",
  comedy: "comedy club",
  attractions: "tourist attractions",
  shopping: "shopping",
  outdoors: "parks and outdoor recreation",
  gyms: "gym",
  movie_theaters: "movie theater",
  coffee: "coffee shop",
  truck_stops: "truck stop",
  showers: "truck stop showers",
  laundromats: "laundromat",
};

interface GooglePlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  regularOpeningHours?: { openNow?: boolean };
}

/**
 * Real Google Places (New) Text Search adapter. Requires
 * GOOGLE_MAPS_API_KEY. Google does not expose a "commercial truck parking"
 * signal, so every truck attribute this adapter sets is address-text/
 * category-keyword based and lands in `inferred`, never `verified` — see
 * README.md "Data integrity rule".
 */
export class GooglePlacesProvider implements IPlacesProvider {
  readonly providerName = "google_places";

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("GooglePlacesProvider requires a non-empty API key.");
    }
  }

  async searchNearby(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
    const queryText = CATEGORY_QUERY_TEXT[params.category] ?? params.category;

    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location," +
          "places.rating,places.regularOpeningHours.openNow,places.internationalPhoneNumber",
      },
      body: JSON.stringify({
        textQuery: queryText,
        locationBias: {
          circle: {
            center: { latitude: params.latitude, longitude: params.longitude },
            radius: params.radiusMeters,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Google Places request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as { places?: GooglePlace[] };
    const places = data.places ?? [];

    return places
      .filter((place) => place.location?.latitude != null && place.location?.longitude != null)
      .map((place) => this.toSearchResult(place, params));
  }

  private toSearchResult(place: GooglePlace, params: PlaceSearchParams): PlaceSearchResult {
    const address = place.formattedAddress ?? "";
    const inferred: TruckAttributes["inferred"] = {};
    const addressLower = address.toLowerCase();
    if (addressLower.includes("highway") || addressLower.includes("interstate") || addressLower.includes("truck")) {
      inferred.truck_accessible = true;
      inferred.large_vehicle_parking = true;
    }

    const attrs = emptyTruckAttributes();
    attrs.inferred = inferred;

    return {
      providerId: place.id,
      providerName: this.providerName,
      name: place.displayName?.text ?? "Unnamed place",
      category: params.category,
      latitude: place.location!.latitude as number,
      longitude: place.location!.longitude as number,
      address: address || null,
      phone: place.internationalPhoneNumber ?? null,
      rating: place.rating ?? null,
      isOpenNow: place.regularOpeningHours?.openNow ?? null,
      truckAttributes: attrs,
    };
  }
}
