import type { GPSCoordinates } from "../types.js";

/**
 * Port for wherever the driver's position comes from. The MVP concrete
 * adapter reads the browser's Geolocation API (see
 * providers/BrowserLocationProvider.ts); a future adapter can read from
 * telematics hardware without anything above this interface changing.
 */
export interface ILocationProvider {
  getCurrentLocation(): Promise<GPSCoordinates>;
  /** Returns a watch id usable with clearWatch(). */
  watchLocation(
    onUpdate: (coords: GPSCoordinates) => void,
    onError?: (error: Error) => void
  ): number;
  clearWatch(watchId: number): void;
}
