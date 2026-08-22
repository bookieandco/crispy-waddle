import type { Coordinates } from "../types.js";
import type { LoadOffer } from "./dispatcher.js";

export interface LoadSearchRequest {
  origin: Coordinates | null;
  destinationHint?: string | null;
  maxResults?: number;
}

/** Source of load opportunities for the dispatcher. */
export interface ILoadProvider {
  search(request: LoadSearchRequest): Promise<LoadOffer[]>;
}
