import type { Coordinates } from "../types.js";

export type MapProviderKind = "openstreetmap" | "mapbox" | "google";

/**
 * Port for whatever renders the map. TruckerOS ships one concrete adapter
 * (OpenStreetMapProvider — no API key required, good for an MVP that
 * shouldn't need billing set up to run). Mapbox/Google adapters implement
 * the same interface behind an API key and can be swapped in without
 * touching any screen.
 */
export interface IMapProvider {
  readonly kind: MapProviderKind;
  /** A embeddable URL (iframe `src`) centered on `center` with optional pins. */
  buildEmbedUrl(center: Coordinates, radiusMeters: number, markers?: Coordinates[]): string;
}
