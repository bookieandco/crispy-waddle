import type { IPlacesProvider } from "../interfaces/places.js";
import { GooglePlacesProvider } from "./GooglePlacesProvider.js";
import { MockPlacesProvider } from "./MockPlacesProvider.js";

export { BrowserLocationProvider } from "./BrowserLocationProvider.js";
export { GooglePlacesProvider } from "./GooglePlacesProvider.js";
export { MockPlacesProvider } from "./MockPlacesProvider.js";
export { MockLoadProvider } from "./MockLoadProvider.js";
export { HaversineRoutingProvider } from "./HaversineRoutingProvider.js";
export { OpenStreetMapProvider } from "./OpenStreetMapProvider.js";
export { TemplateDispatcherReasoner } from "./TemplateDispatcherReasoner.js";

/**
 * Chooses the places provider at startup based on configuration, and says
 * so loudly. This is the one place allowed to fall back to mock data — it
 * never happens silently mid-request.
 */
export function createPlacesProvider(googleMapsApiKey: string | undefined): IPlacesProvider {
  if (googleMapsApiKey) {
    return new GooglePlacesProvider(googleMapsApiKey);
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[truckeros-core] GOOGLE_MAPS_API_KEY is not set — using MockPlacesProvider. " +
      "FunFinder results are labeled providerName=\"mock_offline\" and are NOT real places."
  );
  return new MockPlacesProvider();
}
