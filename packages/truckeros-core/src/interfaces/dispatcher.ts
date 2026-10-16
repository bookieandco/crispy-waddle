/**
 * AI Dispatcher boundary.
 *
 * The dispatcher is deliberately split from the LLM. A model may explain,
 * rank, and converse, but it must consume deterministic economics and return
 * a recommendation that the driver can approve. External commitments are
 * never executed by the model itself.
 */

import type { Coordinates, Driver } from "../types.js";

export interface LoadOffer {
  id: string;
  origin: string;
  destination: string;
  pickupAt: string | null;
  deliveryAt: string | null;
  revenueCents: number;
  loadedMiles: number;
  deadheadMiles: number;
  fuelCostCents: number;
  tollCostCents: number;
  otherCostCents: number;
  brokerName: string | null;
}

export interface LoadEconomics {
  grossRevenueCents: number;
  totalMiles: number;
  totalCostsCents: number;
  netProfitCents: number;
  netCentsPerMile: number;
}

export type DispatcherRecommendation = "accept" | "counter" | "decline";

export interface DispatcherCandidate {
  load: LoadOffer;
  economics: LoadEconomics;
  recommendation: DispatcherRecommendation;
  score: number;
  reasons: string[];
}

export interface DispatcherContext {
  driver: Driver;
  currentLocation: Coordinates | null;
  loads: LoadOffer[];
  minimumNetCentsPerMile: number;
  targetNetCentsPerMile: number;
}

export interface DispatcherBrief {
  recommendation: DispatcherRecommendation;
  headline: string;
  candidates: DispatcherCandidate[];
  warnings: string[];
}

/** Optional language-model adapter. The deterministic dispatcher remains usable without one. */
export interface IDispatcherReasoner {
  explain(brief: DispatcherBrief, question?: string): Promise<string>;
}
