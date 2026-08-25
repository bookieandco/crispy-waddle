export type ConnectivityTransport =
  | "wifi"
  | "ethernet"
  | "cellular"
  | "starlink"
  | "satellite"
  | "unknown";

export type ConnectivityState = "online" | "degraded" | "offline";

export interface ConnectivityMetrics {
  latencyMs?: number;
  packetLossPct?: number;
  throughputMbps?: number;
  dnsHealthy?: boolean;
  internetReachable?: boolean;
  lastCheckedAt: string;
}

export interface ConnectivityLink {
  id: string;
  transport: ConnectivityTransport;
  label: string;
  authorized: boolean;
  connected: boolean;
  metrics: ConnectivityMetrics;
  score: number;
}

export interface ConnectivitySnapshot {
  state: ConnectivityState;
  activeLinkId?: string;
  links: ConnectivityLink[];
  observedAt: string;
}

export interface OfflineQueueItem<T = unknown> {
  id: string;
  type: string;
  payload: T;
  createdAt: string;
  attempts: number;
  status: "pending" | "syncing" | "synced" | "failed";
}

export interface LocalKnowledgeSource {
  id: string;
  kind: "model" | "embedding" | "memory" | "document" | "tool";
  name: string;
  version?: string;
  local: true;
  available: boolean;
}

export interface OfflineKnowledgeSnapshot {
  sources: LocalKnowledgeSource[];
  updatedAt: string;
}

export interface ConnectivityCore {
  snapshot(): Promise<ConnectivitySnapshot>;
  enqueue<T>(item: OfflineQueueItem<T>): Promise<void>;
  pendingQueue(): Promise<OfflineQueueItem[]>;
  knowledge(): Promise<OfflineKnowledgeSnapshot>;
}

export function scoreLink(metrics: ConnectivityMetrics): number {
  let score = 0;
  if (metrics.internetReachable) score += 40;
  if (metrics.dnsHealthy) score += 15;
  if (metrics.latencyMs !== undefined) score += Math.max(0, 20 - Math.min(20, metrics.latencyMs / 50));
  if (metrics.packetLossPct !== undefined) score += Math.max(0, 15 - Math.min(15, metrics.packetLossPct * 3));
  if (metrics.throughputMbps !== undefined) score += Math.min(10, metrics.throughputMbps / 10);
  return Math.max(0, Math.min(100, score));
}
