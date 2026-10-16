import type { IRoutingProvider, RouteEstimate } from "../interfaces/routing.js";
import type { Coordinates } from "../types.js";
import { estimateDriveMinutes, haversineDistanceMeters } from "../geo.js";

/**
 * Straight-line distance / assumed-speed ETA. This is explicitly a
 * placeholder — it exists so FunFinder has *something* to sort and display
 * before a real routing provider is wired in, and it labels its own output
 * (`method: "haversine_estimate"`, `truckAwareRouting: false`) so nothing
 * downstream can present it as a routed distance or a truck-legal route.
 *
 * Swap this for a Directions-API-backed IRoutingProvider once a provider is
 * selected (see README.md "External providers").
 */
export class HaversineRoutingProvider implements IRoutingProvider {
  constructor(private readonly averageSpeedMph?: number) {}

  async estimateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteEstimate> {
    const distanceMeters = haversineDistanceMeters(origin, destination);
    return {
      distanceMeters,
      etaMinutes: estimateDriveMinutes(distanceMeters, this.averageSpeedMph),
      method: "haversine_estimate",
      truckAwareRouting: false,
    };
  }
}
