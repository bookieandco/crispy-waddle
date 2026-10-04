export type PortableRuntimeMode = 'staging' | 'homebase' | 'production';

export type PortableLocation =
  | 'homebase'
  | 'runpod'
  | 'managed-external'
  | 'local-dev';

export type PersistenceClass =
  | 'ephemeral'
  | 'persistent-volume'
  | 'durable-disk'
  | 'replicated';

export type PortableServiceKind =
  | 'database'
  | 'object-storage'
  | 'cache'
  | 'queue'
  | 'compute'
  | 'backup';

export type PortableService = {
  id: string;
  kind: PortableServiceKind;
  implementation: string;
  location: PortableLocation;
  persistence: PersistenceClass;
  endpointEnv?: string;
  dataRootEnv?: string;
  canonical?: boolean;
  sensitiveData?: boolean;
  externalSpend?: boolean;
  enabled: boolean;
};

export type ResearchEvidencePolicy = {
  enabled: boolean;
  requireSourceUrl: boolean;
  requireObservedAt: boolean;
  requireContentHash: boolean;
  requireSubsystemOwner: boolean;
  durableMetadataServiceId: string;
  durableObjectServiceId?: string;
};

export type PortableInfrastructureManifest = {
  version: 'JHADINA-PORTABLE.1';
  mode: PortableRuntimeMode;
  services: PortableService[];
  research: ResearchEvidencePolicy;
  allowExternalCompute: boolean;
  allowRemoteCanonicalDatabase: boolean;
  requireEncryptedBackups: boolean;
  externalMonthlyBudgetUsd?: number;
};

export type PortableInfrastructureAssessment = {
  admissible: boolean;
  blockingReasons: string[];
  warnings: string[];
  canonicalDatabaseId?: string;
  objectStoreId?: string;
  cacheId?: string;
  queueId?: string;
  computeIds: string[];
  backupIds: string[];
};

function enabledOfKind(
  manifest: PortableInfrastructureManifest,
  kind: PortableServiceKind,
): PortableService[] {
  return manifest.services.filter((service) => service.enabled && service.kind === kind);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function validatePortableInfrastructure(
  manifest: PortableInfrastructureManifest,
): PortableInfrastructureAssessment {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const databases = enabledOfKind(manifest, 'database');
  const canonicalDatabases = databases.filter((service) => service.canonical);
  const objectStores = enabledOfKind(manifest, 'object-storage');
  const caches = enabledOfKind(manifest, 'cache');
  const queues = enabledOfKind(manifest, 'queue');
  const computes = enabledOfKind(manifest, 'compute');
  const backups = enabledOfKind(manifest, 'backup');

  if (canonicalDatabases.length !== 1) {
    blockingReasons.push('EXACTLY_ONE_CANONICAL_DATABASE_REQUIRED');
  }

  const canonicalDatabase = canonicalDatabases[0];
  if (canonicalDatabase) {
    if (canonicalDatabase.implementation.toLowerCase() !== 'postgresql') {
      blockingReasons.push('CANONICAL_DATABASE_MUST_BE_POSTGRESQL');
    }
    if (canonicalDatabase.persistence === 'ephemeral') {
      blockingReasons.push('CANONICAL_DATABASE_CANNOT_BE_EPHEMERAL');
    }
    if (
      manifest.mode !== 'staging' &&
      canonicalDatabase.location === 'runpod' &&
      !manifest.allowRemoteCanonicalDatabase
    ) {
      blockingReasons.push('RUNPOD_CANONICAL_DATABASE_NOT_ADMITTED');
    }
    if (!canonicalDatabase.endpointEnv?.trim()) {
      blockingReasons.push('CANONICAL_DATABASE_ENDPOINT_ENV_REQUIRED');
    }
  }

  if (objectStores.length === 0) {
    blockingReasons.push('OBJECT_STORAGE_REQUIRED');
  }

  if (caches.length === 0) warnings.push('CACHE_NOT_CONFIGURED');
  if (queues.length === 0) warnings.push('QUEUE_NOT_CONFIGURED');

  const externalCompute = computes.filter(
    (service) => service.location === 'runpod' || service.location === 'managed-external',
  );
  if (externalCompute.length > 0 && !manifest.allowExternalCompute) {
    blockingReasons.push('EXTERNAL_COMPUTE_NOT_AUTHORIZED');
  }
  if (
    externalCompute.some((service) => service.externalSpend) &&
    (!Number.isFinite(manifest.externalMonthlyBudgetUsd) ||
      (manifest.externalMonthlyBudgetUsd ?? 0) <= 0)
  ) {
    blockingReasons.push('EXTERNAL_SPEND_BUDGET_REQUIRED');
  }

  const durableBackups = backups.filter(
    (service) => service.persistence !== 'ephemeral',
  );
  if (durableBackups.length === 0) {
    blockingReasons.push('DURABLE_BACKUP_TARGET_REQUIRED');
  }

  if (manifest.requireEncryptedBackups) {
    const encrypted = durableBackups.some(
      (service) => service.sensitiveData === true,
    );
    if (!encrypted) blockingReasons.push('ENCRYPTED_BACKUP_TARGET_REQUIRED');
  }

  if (manifest.research.enabled) {
    if (!manifest.research.requireSourceUrl) {
      blockingReasons.push('RESEARCH_SOURCE_URL_REQUIRED');
    }
    if (!manifest.research.requireObservedAt) {
      blockingReasons.push('RESEARCH_OBSERVED_AT_REQUIRED');
    }
    if (!manifest.research.requireContentHash) {
      blockingReasons.push('RESEARCH_CONTENT_HASH_REQUIRED');
    }
    if (!manifest.research.requireSubsystemOwner) {
      blockingReasons.push('RESEARCH_SUBSYSTEM_OWNER_REQUIRED');
    }

    const metadataService = manifest.services.find(
      (service) =>
        service.enabled &&
        service.id === manifest.research.durableMetadataServiceId,
    );
    if (!metadataService || metadataService.kind !== 'database') {
      blockingReasons.push('RESEARCH_DURABLE_METADATA_STORE_REQUIRED');
    }

    if (manifest.research.durableObjectServiceId) {
      const objectService = manifest.services.find(
        (service) =>
          service.enabled &&
          service.id === manifest.research.durableObjectServiceId,
      );
      if (!objectService || objectService.kind !== 'object-storage') {
        blockingReasons.push('RESEARCH_DURABLE_OBJECT_STORE_REQUIRED');
      }
    }
  }

  for (const service of manifest.services.filter((item) => item.enabled)) {
    if (
      service.canonical &&
      service.persistence === 'ephemeral'
    ) {
      blockingReasons.push(`CANONICAL_SERVICE_EPHEMERAL:${service.id}`);
    }
    if (
      service.location === 'managed-external' &&
      service.sensitiveData &&
      !service.externalSpend
    ) {
      warnings.push(`EXTERNAL_SENSITIVE_SERVICE_REVIEW:${service.id}`);
    }
  }

  return {
    admissible: blockingReasons.length === 0,
    blockingReasons: unique(blockingReasons),
    warnings: unique(warnings),
    canonicalDatabaseId: canonicalDatabase?.id,
    objectStoreId: objectStores[0]?.id,
    cacheId: caches[0]?.id,
    queueId: queues[0]?.id,
    computeIds: computes.map((service) => service.id).sort(),
    backupIds: backups.map((service) => service.id).sort(),
  };
}

export function createPortableStagingManifest(): PortableInfrastructureManifest {
  return {
    version: 'JHADINA-PORTABLE.1',
    mode: 'staging',
    allowExternalCompute: true,
    allowRemoteCanonicalDatabase: false,
    requireEncryptedBackups: true,
    externalMonthlyBudgetUsd: 100,
    services: [
      {
        id: 'postgres-staging',
        kind: 'database',
        implementation: 'postgresql',
        location: 'runpod',
        persistence: 'persistent-volume',
        endpointEnv: 'DATABASE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        canonical: true,
        sensitiveData: true,
        enabled: true,
      },
      {
        id: 'objects-staging',
        kind: 'object-storage',
        implementation: 'minio',
        location: 'runpod',
        persistence: 'persistent-volume',
        endpointEnv: 'JHADINA_OBJECT_STORE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        sensitiveData: true,
        enabled: true,
      },
      {
        id: 'cache-staging',
        kind: 'cache',
        implementation: 'valkey',
        location: 'runpod',
        persistence: 'ephemeral',
        endpointEnv: 'JHADINA_CACHE_URL',
        enabled: true,
      },
      {
        id: 'queue-staging',
        kind: 'queue',
        implementation: 'nats',
        location: 'runpod',
        persistence: 'persistent-volume',
        endpointEnv: 'JHADINA_QUEUE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        enabled: true,
      },
      {
        id: 'runpod-burst',
        kind: 'compute',
        implementation: 'runpod',
        location: 'runpod',
        persistence: 'ephemeral',
        endpointEnv: 'RUNPOD_API_KEY',
        externalSpend: true,
        enabled: true,
      },
      {
        id: 'encrypted-staging-backup',
        kind: 'backup',
        implementation: 'restic-or-rclone',
        location: 'runpod',
        persistence: 'persistent-volume',
        dataRootEnv: 'JHADINA_BACKUP_ROOT',
        sensitiveData: true,
        enabled: true,
      },
    ],
    research: {
      enabled: true,
      requireSourceUrl: true,
      requireObservedAt: true,
      requireContentHash: true,
      requireSubsystemOwner: true,
      durableMetadataServiceId: 'postgres-staging',
      durableObjectServiceId: 'objects-staging',
    },
  };
}

export function createHomebaseManifest(): PortableInfrastructureManifest {
  return {
    version: 'JHADINA-PORTABLE.1',
    mode: 'homebase',
    allowExternalCompute: true,
    allowRemoteCanonicalDatabase: false,
    requireEncryptedBackups: true,
    externalMonthlyBudgetUsd: 100,
    services: [
      {
        id: 'postgres-homebase',
        kind: 'database',
        implementation: 'postgresql',
        location: 'homebase',
        persistence: 'durable-disk',
        endpointEnv: 'DATABASE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        canonical: true,
        sensitiveData: true,
        enabled: true,
      },
      {
        id: 'objects-homebase',
        kind: 'object-storage',
        implementation: 'minio',
        location: 'homebase',
        persistence: 'durable-disk',
        endpointEnv: 'JHADINA_OBJECT_STORE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        sensitiveData: true,
        enabled: true,
      },
      {
        id: 'cache-homebase',
        kind: 'cache',
        implementation: 'valkey',
        location: 'homebase',
        persistence: 'ephemeral',
        endpointEnv: 'JHADINA_CACHE_URL',
        enabled: true,
      },
      {
        id: 'queue-homebase',
        kind: 'queue',
        implementation: 'nats',
        location: 'homebase',
        persistence: 'durable-disk',
        endpointEnv: 'JHADINA_QUEUE_URL',
        dataRootEnv: 'JHADINA_DATA_ROOT',
        enabled: true,
      },
      {
        id: 'compute-homebase',
        kind: 'compute',
        implementation: 'k3s',
        location: 'homebase',
        persistence: 'ephemeral',
        enabled: true,
      },
      {
        id: 'runpod-burst',
        kind: 'compute',
        implementation: 'runpod',
        location: 'runpod',
        persistence: 'ephemeral',
        endpointEnv: 'RUNPOD_API_KEY',
        externalSpend: true,
        enabled: true,
      },
      {
        id: 'encrypted-homebase-backup',
        kind: 'backup',
        implementation: 'restic-or-rclone',
        location: 'homebase',
        persistence: 'durable-disk',
        dataRootEnv: 'JHADINA_BACKUP_ROOT',
        sensitiveData: true,
        enabled: true,
      },
    ],
    research: {
      enabled: true,
      requireSourceUrl: true,
      requireObservedAt: true,
      requireContentHash: true,
      requireSubsystemOwner: true,
      durableMetadataServiceId: 'postgres-homebase',
      durableObjectServiceId: 'objects-homebase',
    },
  };
}
