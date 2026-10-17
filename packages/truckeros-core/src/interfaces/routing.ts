import type { Coordinates } from "../types.js";

export interface RouteEstimate {
  distanceMeters: number;
  etaMinutes: number;
  /**
   * "haversine_estimate" means straight-line distance over an assumed
   * average speed — a placeholder good enough to sort/display, never to be
   * confused with a real routed distance. "provider_directions" means an
   * actual routing API computed it.
   */
  method: "haversine_estimate" | "provider_directions";
  /**
   * Always false in this MVP. No routing provider here claims to account
   * for bridge heights, weight limits, or commercial-vehicle restrictions —
   * see packages/truckeros-core/README.md for why that's deferred rather
   * than faked.
   */
  truckAwareRouting: boolean;
}

/**
 * Port for distance/ETA calculation. The MVP adapter
 * (HaversineRoutingProvider) is a placeholder; a real routing provider
 * (Mapbox Directions, Google Routes, or a commercial-vehicle routing API)
 * is selected later per BACKEND deployment needs, behind this same
 * interface.
 */
export interface IRoutingProvider {
  estimateRoute(origin: Coordinates, destination: Coordinates): Promise<RouteEstimate>;
}

export interface NavigationHandoffLinks {
  /** Universal `geo:` URI — most Android navigation apps register for this. */
  geo: string;
  googleMaps: string;
  appleMaps: string;
}

/**
 * Builds native navigation deep links for a destination. TruckerOS does not
 * implement turn-by-turn navigation — it hands off to whichever app the
 * driver already has installed.
 */
export function buildNavigationHandoffLinks(
  destination: Coordinates,
  label: string
): NavigationHandoffLinks {
  const { latitude, longitude } = destination;
  const encodedLabel = encodeURIComponent(label);
  return {
    geo: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`,
    appleMaps: `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`,
  };
}
