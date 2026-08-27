export type SignalTransport = "wifi" | "cellular" | "satellite";

export type AccessStatus = "authorized" | "requires_auth" | "unknown" | "unavailable";

export interface ObservedSignal {
  id: string;
  transport: SignalTransport;
  label: string;
  access: AccessStatus;
  signalStrength?: number;
  networkName?: string;
  source: "device" | "public-catalog" | "provider-adapter";
  observedAt: string;
  latitude?: number;
  longitude?: number;
}

export interface FreeConnectivityOpportunity extends ObservedSignal {
  free: boolean;
  verifiedFree: boolean;
  distanceMeters?: number;
  evidence?: string;
}

export interface SignalScanner {
  scan(): Promise<ObservedSignal[]>;
}

export interface PublicConnectivityCatalog {
  findNearby(input: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }): Promise<FreeConnectivityOpportunity[]>;
}

/**
 * Conservative classifier: an open/visible signal is never treated as free
 * merely because it has no password. Only an explicitly verified public/free
 * source may be marked `verifiedFree`.
 */
export function classifyFreeSignal(signal: ObservedSignal): FreeConnectivityOpportunity {
  return {
    ...signal,
    free: false,
    verifiedFree: false,
  };
}

export function mergeConnectivityOpportunities(
  observed: ObservedSignal[],
  catalog: FreeConnectivityOpportunity[],
): FreeConnectivityOpportunity[] {
  const byId = new Map<string, FreeConnectivityOpportunity>();

  for (const signal of observed) byId.set(signal.id, classifyFreeSignal(signal));
  for (const opportunity of catalog) {
    const existing = byId.get(opportunity.id);
    byId.set(opportunity.id, {
      ...(existing ?? opportunity),
      ...opportunity,
      free: opportunity.free,
      verifiedFree: opportunity.verifiedFree,
    });
  }

  return [...byId.values()].sort((a, b) => {
    if (a.verifiedFree !== b.verifiedFree) return a.verifiedFree ? -1 : 1;
    return (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY);
  });
}
