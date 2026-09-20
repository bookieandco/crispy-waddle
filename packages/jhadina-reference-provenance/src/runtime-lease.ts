import { createHash } from 'node:crypto';
import type {
  ArtifactRevocationReceipt,
  DeploymentSession,
  DeploymentSessionLedger,
} from './deployment-session.js';
import { assertDeploymentSessionUsable } from './deployment-session.js';

export const RUNTIME_LEASE_SCHEMA_VERSION = 'REF-PROV-08' as const;

export type RevocationDistributionSnapshot = Readonly<{
  schemaVersion: typeof RUNTIME_LEASE_SCHEMA_VERSION;
  epoch: number;
  generatedAt: string;
  expiresAt: string;
  revocations: readonly ArtifactRevocationReceipt[];
  snapshotHash: string;
}>;

export interface RevocationDistributionSource {
  loadSnapshot(): Promise<RevocationDistributionSnapshot>;
}

export type RuntimeLeaseGuardOptions = Readonly<{
  sessionLedger: DeploymentSessionLedger;
  sessionId: string;
  revocationSource: RevocationDistributionSource;
  maxStaleMs: number;
}>;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error('REF_PROV_CANONICAL_VALUE_UNSUPPORTED');
    return encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .filter((key) => object[key] !== undefined)
    .map((key) => JSON.stringify(key) + ':' + canonical(object[key]))
    .join(',') + '}';
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function parseTime(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(code);
  return parsed;
}

export function createRevocationDistributionSnapshot(input: Readonly<{
  epoch: number;
  generatedAt: string;
  expiresAt: string;
  revocations: readonly ArtifactRevocationReceipt[];
}>): RevocationDistributionSnapshot {
  if (!Number.isSafeInteger(input.epoch) || input.epoch < 0) {
    throw new Error('REF_PROV_08_REVOCATION_EPOCH_INVALID');
  }
  const generated = parseTime(input.generatedAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
  const expires = parseTime(input.expiresAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
  if (expires <= generated) throw new Error('REF_PROV_08_SNAPSHOT_EXPIRY_INVALID');
  const revocations = Object.freeze(
    [...input.revocations].sort((a, b) =>
      a.revokedAt.localeCompare(b.revokedAt) ||
      a.revocationId.localeCompare(b.revocationId),
    ),
  );
  const withoutHash = {
    schemaVersion: RUNTIME_LEASE_SCHEMA_VERSION,
    epoch: input.epoch,
    generatedAt: new Date(generated).toISOString(),
    expiresAt: new Date(expires).toISOString(),
    revocations,
  } as const;
  return Object.freeze({ ...withoutHash, snapshotHash: hash(withoutHash) });
}

export function verifyRevocationDistributionSnapshot(
  snapshot: RevocationDistributionSnapshot,
): void {
  const { snapshotHash, ...withoutHash } = snapshot;
  if (snapshot.schemaVersion !== RUNTIME_LEASE_SCHEMA_VERSION) {
    throw new Error('REF_PROV_08_SNAPSHOT_VERSION_UNSUPPORTED');
  }
  if (hash(withoutHash) !== snapshotHash) {
    throw new Error('REF_PROV_08_SNAPSHOT_HASH_MISMATCH');
  }
  parseTime(snapshot.generatedAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
  parseTime(snapshot.expiresAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
}

function targetsSession(
  revocation: ArtifactRevocationReceipt,
  session: DeploymentSession,
): boolean {
  return (
    (revocation.targetType === 'ADMISSION' &&
      revocation.targetId === session.admissionId) ||
    (revocation.targetType === 'ARTIFACT_PIN' &&
      revocation.targetId === session.pinId) ||
    (revocation.targetType === 'ARTIFACT_DIGEST' &&
      revocation.targetId === session.artifactDigest)
  );
}

export class RuntimeLeaseGuard {
  private cached?: RevocationDistributionSnapshot;

  constructor(private readonly options: RuntimeLeaseGuardOptions) {
    if (!Number.isInteger(options.maxStaleMs) || options.maxStaleMs < 0) {
      throw new Error('REF_PROV_08_MAX_STALE_INVALID');
    }
  }

  private async currentSnapshot(at: string): Promise<RevocationDistributionSnapshot> {
    const now = parseTime(at, 'REF_PROV_08_CHECK_TIME_INVALID');
    let next: RevocationDistributionSnapshot | undefined;
    try {
      next = await this.options.revocationSource.loadSnapshot();
    } catch (error) {
      if (!this.cached) throw error;
    }
    if (next) {
      verifyRevocationDistributionSnapshot(next);
      if (this.cached && next.epoch < this.cached.epoch) {
        throw new Error('REF_PROV_08_REVOCATION_EPOCH_ROLLBACK');
      }
      if (parseTime(next.generatedAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID') > now) {
        throw new Error('REF_PROV_08_SNAPSHOT_FROM_FUTURE');
      }
      this.cached = next;
    }

    const snapshot = this.cached!;
    const generatedAt = parseTime(snapshot.generatedAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
    const expiresAt = parseTime(snapshot.expiresAt, 'REF_PROV_08_SNAPSHOT_TIME_INVALID');
    if (now >= expiresAt) throw new Error('REF_PROV_08_REVOCATION_SNAPSHOT_EXPIRED');
    if (now - generatedAt > this.options.maxStaleMs) {
      throw new Error('REF_PROV_08_REVOCATION_CACHE_STALE');
    }
    return snapshot;
  }

  async assertUsable(at: string): Promise<Readonly<{
    session: DeploymentSession;
    revocationSnapshotHash: string;
    revocationEpoch: number;
  }>> {
    const session = await assertDeploymentSessionUsable(
      this.options.sessionLedger,
      this.options.sessionId,
      at,
    );
    const snapshot = await this.currentSnapshot(at);
    const now = Date.parse(at);
    if (
      snapshot.revocations.some(
        (item) =>
          targetsSession(item, session) &&
          Date.parse(item.revokedAt) <= now,
      )
    ) {
      throw new Error('REF_PROV_08_RUNTIME_LEASE_REVOKED');
    }
    return Object.freeze({
      session,
      revocationSnapshotHash: snapshot.snapshotHash,
      revocationEpoch: snapshot.epoch,
    });
  }
}

export class InMemoryRevocationDistributionSource
  implements RevocationDistributionSource
{
  constructor(
    private snapshot: RevocationDistributionSnapshot,
    private available = true,
  ) {}

  setSnapshot(snapshot: RevocationDistributionSnapshot): void {
    this.snapshot = snapshot;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  async loadSnapshot(): Promise<RevocationDistributionSnapshot> {
    if (!this.available) throw new Error('REF_PROV_08_REVOCATION_SOURCE_UNAVAILABLE');
    return this.snapshot;
  }
}

export type RevocationSnapshotFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export class HttpRevocationDistributionSource
  implements RevocationDistributionSource
{
  constructor(
    private readonly endpoint: string,
    private readonly fetchFn: RevocationSnapshotFetch = fetch,
    private readonly headers: Readonly<Record<string, string>> = {},
  ) {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      throw new Error('REF_PROV_08_REVOCATION_ENDPOINT_HTTPS_REQUIRED');
    }
  }

  async loadSnapshot(): Promise<RevocationDistributionSnapshot> {
    const response = await this.fetchFn(this.endpoint, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        ...this.headers,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error(
        'REF_PROV_08_REVOCATION_SOURCE_HTTP_' + response.status,
      );
    }
    const snapshot =
      (await response.json()) as RevocationDistributionSnapshot;
    verifyRevocationDistributionSnapshot(snapshot);
    return snapshot;
  }
}
