import type { IPlacesProvider, PlaceSearchParams, PlaceSearchResult } from "../interfaces/places.js";
import type { TruckAttributes } from "../types.js";
import { emptyTruckAttributes } from "../types.js";

/**
 * Deterministic offline fallback. Used only when no real places API key is
 * configured (see providers/index.ts createPlacesProvider), and it never
 * hides what it is: every result carries providerName "mock_offline" and
 * every truck-related flag it sets lands in the `inferred` bucket, never
 * `verified` — this data is a guess, not a confirmed fact, and callers can
 * tell the difference (see resolveTruckAttribute in ../types.ts).
 */
export class MockPlacesProvider implements IPlacesProvider {
  readonly providerName = "mock_offline";

  async searchNearby(params: PlaceSearchParams): Promise<PlaceSearchResult[]> {
    const templates = TEMPLATES[params.category] ?? TEMPLATES.default;

    // Meters-per-degree at this latitude, matching the approximation
    // geo.ts's boundingBox() uses. Offsets are derived from radiusMeters
    // so results actually land inside the requested search radius instead
    // of a set of fixed constants that quietly ignored it (and could put
    // "nearby" results outside a small requested radius, or bunch them
    // unrealistically close for a large one).
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = metersPerDegreeLat * Math.cos((params.latitude * Math.PI) / 180) || 1;

    return templates.map((template, index) => {
      // Spread templates from ~20% to ~80% of the requested radius, at
      // alternating diagonal bearings, so markers land at plausible,
      // varied distances instead of stacking on one point.
      const fraction = 0.2 + (0.6 * (index + 1)) / (templates.length + 1);
      const distanceMeters = params.radiusMeters * fraction;
      const sign = index % 2 === 0 ? 1 : -1;
      const latOffset = ((distanceMeters * Math.SQRT1_2) / metersPerDegreeLat) * sign;
      const lngOffset = ((distanceMeters * Math.SQRT1_2) / metersPerDegreeLng) * -sign;

      const inferred: TruckAttributes["inferred"] = template.hasBigLot
        ? { truck_accessible: true, large_vehicle_parking: true }
        : {};

      const attrs = emptyTruckAttributes();
      attrs.inferred = inferred;

      return {
        providerId: `mock_${params.category}_${index}`,
        providerName: this.providerName,
        name: template.name,
        category: params.category,
        latitude: params.latitude + latOffset,
        longitude: params.longitude + lngOffset,
        address: `${100 + index * 40} ${template.roadContext}, offline sample data`,
        phone: null,
        rating: template.rating,
        isOpenNow: template.isOpenNow,
        truckAttributes: attrs,
      } satisfies PlaceSearchResult;
    });
  }
}

interface Template {
  name: string;
  roadContext: string;
  rating: number;
  isOpenNow: boolean | null;
  hasBigLot: boolean;
}

const TEMPLATES: Record<string, Template[]> = {
  bbq: [
    { name: "Smokehouse Pullout BBQ", roadContext: "Highway Frontage Rd", rating: 4.6, isOpenNow: true, hasBigLot: true },
    { name: "Gearbox Pitmaster Ribs", roadContext: "Exit 4 Service Rd", rating: 4.1, isOpenNow: true, hasBigLot: true },
    { name: "Downtown Slow Smoked", roadContext: "Main St", rating: 4.3, isOpenNow: false, hasBigLot: false },
  ],
  truck_stops: [
    { name: "Cross-Country Travel Plaza", roadContext: "I-Corridor Mile 118", rating: 4.2, isOpenNow: true, hasBigLot: true },
    { name: "Overpass Fuel & Rest", roadContext: "County Rd 12", rating: 3.8, isOpenNow: true, hasBigLot: true },
  ],
  showers: [
    { name: "HydroRoute Driver Showers", roadContext: "Travel Plaza", rating: 4.5, isOpenNow: true, hasBigLot: true },
    { name: "Iron Horse Wash & Fuel", roadContext: "Commercial Way", rating: 3.6, isOpenNow: true, hasBigLot: true },
  ],
  laundromats: [
    { name: "Rig Row Laundry", roadContext: "Truck Row", rating: 4.0, isOpenNow: true, hasBigLot: true },
  ],
  coffee: [
    { name: "Overpass Coffee & Fuel", roadContext: "County Rd Mile 12", rating: 4.4, isOpenNow: true, hasBigLot: true },
  ],
  default: [
    { name: "Riggers Entertainment Lounge", roadContext: "Industrial Bypass", rating: 3.9, isOpenNow: true, hasBigLot: false },
    { name: "County Line Attraction", roadContext: "Route 9", rating: 4.0, isOpenNow: null, hasBigLot: false },
  ],
};
