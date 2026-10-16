import type { IMapProvider } from "../interfaces/maps.js";
import type { Coordinates } from "../types.js";
import { boundingBox } from "../geo.js";

/**
 * MVP concrete IMapProvider. Uses OpenStreetMap's public embed endpoint —
 * no API key, no billing account needed to run the prototype. A Mapbox or
 * Google adapter can implement the same interface behind an API key later
 * without any screen changing.
 */
export class OpenStreetMapProvider implements IMapProvider {
  readonly kind = "openstreetmap" as const;

  buildEmbedUrl(center: Coordinates, radiusMeters: number, markers: Coordinates[] = []): string {
    const box = boundingBox(center, radiusMeters);
    const bbox = `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`;
    const params = new URLSearchParams({
      bbox,
      layer: "mapnik",
      marker: `${center.latitude},${center.longitude}`,
    });
    // OSM's embed endpoint only supports a single `marker` param, so the
    // driver's own position is always the one pinned; place markers render
    // client-side over the results list instead of on this embed.
    void markers;
    return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
  }
}
