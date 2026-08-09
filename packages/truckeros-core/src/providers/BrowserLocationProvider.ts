import type { ILocationProvider } from "../interfaces/location.js";
import type { GPSCoordinates } from "../types.js";

/**
 * Browser Geolocation adapter — the MVP's concrete ILocationProvider.
 *
 * Client-side only. A telematics-backed ILocationProvider (reading from
 * hardware instead of `navigator.geolocation`) can replace this later
 * without FunFinderService or any screen changing, because everything
 * downstream only knows about the ILocationProvider interface.
 */
export class BrowserLocationProvider implements ILocationProvider {
  private assertBrowser(): void {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      throw new Error(
        "BrowserLocationProvider requires a browser with the Geolocation API. " +
          "Use it only from client components."
      );
    }
  }

  getCurrentLocation(): Promise<GPSCoordinates> {
    this.assertBrowser();
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(toGPSCoordinates(position)),
        (error) => reject(toLocationError(error)),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }

  watchLocation(
    onUpdate: (coords: GPSCoordinates) => void,
    onError?: (error: Error) => void
  ): number {
    this.assertBrowser();
    return navigator.geolocation.watchPosition(
      (position) => onUpdate(toGPSCoordinates(position)),
      (error) => onError?.(toLocationError(error)),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  clearWatch(watchId: number): void {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.clearWatch(watchId);
  }
}

function toGPSCoordinates(position: GeolocationPosition): GPSCoordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? null,
    heading: position.coords.heading ?? null,
    speed: position.coords.speed ?? null,
    timestamp: position.timestamp,
  };
}

function toLocationError(error: GeolocationPositionError): Error {
  const reasons: Record<number, string> = {
    1: "Location permission denied",
    2: "Location unavailable",
    3: "Location request timed out",
  };
  return new Error(reasons[error.code] ?? error.message);
}
