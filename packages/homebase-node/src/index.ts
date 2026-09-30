export type HomebaseHealth = "healthy" | "degraded" | "offline";

export interface HomebaseNode {
  id: string;
  name: string;
  region?: string;
  health: HomebaseHealth;
  lastHeartbeatAt?: string;
  localInference: boolean;
  persistentStorage: boolean;
}

export interface RegisteredDevice {
  id: string;
  label: string;
  publicKey: string;
  lastSeenAt?: string;
  status: "active" | "revoked" | "pending";
}

export interface SyncEnvelope<T = unknown> {
  id: string;
  deviceId: string;
  createdAt: string;
  sequence: number;
  kind: string;
  payload: T;
  idempotencyKey: string;
}

export interface HomebaseStore {
  getNode(): Promise<HomebaseNode>;
  listDevices(): Promise<RegisteredDevice[]>;
  append<T>(envelope: SyncEnvelope<T>): Promise<void>;
  pendingSync(deviceId?: string): Promise<SyncEnvelope[]>;
  acknowledge(ids: string[]): Promise<void>;
}

export interface HomebaseCoordinator {
  heartbeat(): Promise<HomebaseNode>;
  registerDevice(device: RegisteredDevice): Promise<void>;
  queue<T>(envelope: SyncEnvelope<T>): Promise<void>;
  reconcile(deviceId: string): Promise<SyncEnvelope[]>;
}

/**
 * Stable idempotency key construction. A real implementation should derive
 * the final key from authenticated device identity plus the envelope ID.
 */
export function syncKey(deviceId: string, envelopeId: string): string {
  return `${deviceId}:${envelopeId}`;
}
