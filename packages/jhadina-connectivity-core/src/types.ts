export type ConnectionKind =
  | "wifi"
  | "ethernet"
  | "cellular"
  | "starlink"
  | "satellite"
  | "ntn"
  | "other";

export type ConnectionState = "unknown" | "healthy" | "degraded" | "offline";

export interface ConnectionPath {
  id: string;
  kind: ConnectionKind;
  name: string;
  priority: number;
  enabled: boolean;
  metered?: boolean;
  costPerMb?: number;
  capabilities: {
    internet: boolean;
    lowBandwidthFallback: boolean;
  };
}

export interface PathProbeResult {
  pathId: string;
  state: ConnectionState;
  checkedAt: string;
  latencyMs?: number;
  packetLossPct?: number;
  dnsReachable: boolean;
  internetReachable: boolean;
  score: number;
  error?: string;
}

export interface ConnectivitySnapshot {
  state: ConnectionState;
  activePathId?: string;
  checkedAt: string;
  paths: PathProbeResult[];
}

export interface ConnectivityPolicy {
  minScore: number;
  failoverAfterConsecutiveFailures: number;
  recoveryAfterConsecutiveSuccesses: number;
  allowMeteredFallback: boolean;
  requireInternetReachability: boolean;
}
