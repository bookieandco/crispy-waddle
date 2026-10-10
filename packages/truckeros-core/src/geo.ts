import type { Coordinates } from "./types.js";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in meters. */
export function haversineDistanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_METERS * c;
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/**
 * Assumed average road speed used only by the haversine ETA placeholder.
 * Deliberately conservative for a loaded commercial truck, not a car.
 */
export const ASSUMED_AVERAGE_SPEED_MPH = 45;

export function estimateDriveMinutes(
  distanceMeters: number,
  averageSpeedMph: number = ASSUMED_AVERAGE_SPEED_MPH
): number {
  const miles = metersToMiles(distanceMeters);
  const hours = miles / averageSpeedMph;
  return Math.max(1, Math.round(hours * 60));
}

/** Rough bounding box around a center point, for map embeds. Not geodesically exact. */
export function boundingBox(center: Coordinates, radiusMeters: number) {
  const latDelta = radiusMeters / 111320; // meters per degree latitude
  const lngDelta =
    radiusMeters / (111320 * Math.cos(toRadians(center.latitude)) || 1);
  return {
    minLat: center.latitude - latDelta,
    maxLat: center.latitude + latDelta,
    minLng: center.longitude - lngDelta,
    maxLng: center.longitude + lngDelta,
  };
}
