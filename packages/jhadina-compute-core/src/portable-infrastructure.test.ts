import { describe, expect, it } from 'vitest';
import {
  createHomebaseManifest,
  createPortableStagingManifest,
  validatePortableInfrastructure,
  type PortableInfrastructureManifest,
} from './portable-infrastructure.js';

describe('portable infrastructure admission', () => {
  it('admits the RunPod staging topology only as staging', () => {
    const manifest = createPortableStagingManifest();
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(true);
    expect(result.canonicalDatabaseId).toBe('postgres-staging');
    expect(result.computeIds).toContain('runpod-burst');
  });

  it('refuses to silently turn the RunPod staging database into production authority', () => {
    const manifest: PortableInfrastructureManifest = {
      ...createPortableStagingManifest(),
      mode: 'production',
    };
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(false);
    expect(result.blockingReasons).toContain('RUNPOD_CANONICAL_DATABASE_NOT_ADMITTED');
  });

  it('admits Homebase as canonical authority while retaining explicit RunPod burst', () => {
    const manifest = createHomebaseManifest();
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(true);
    expect(result.canonicalDatabaseId).toBe('postgres-homebase');
    expect(result.computeIds).toEqual(['compute-homebase', 'runpod-burst']);
  });

  it('requires durable backups before admitting a topology', () => {
    const manifest = createHomebaseManifest();
    manifest.services = manifest.services.filter((service) => service.kind !== 'backup');
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(false);
    expect(result.blockingReasons).toContain('DURABLE_BACKUP_TARGET_REQUIRED');
  });

  it('requires explicit budget when paid external compute is enabled', () => {
    const manifest = createHomebaseManifest();
    delete manifest.externalMonthlyBudgetUsd;
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(false);
    expect(result.blockingReasons).toContain('EXTERNAL_SPEND_BUDGET_REQUIRED');
  });

  it('requires provenance fields when research evidence is enabled', () => {
    const manifest = createHomebaseManifest();
    manifest.research = {
      ...manifest.research,
      requireContentHash: false,
      requireObservedAt: false,
    };
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(false);
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        'RESEARCH_CONTENT_HASH_REQUIRED',
        'RESEARCH_OBSERVED_AT_REQUIRED',
      ]),
    );
  });

  it('rejects an ephemeral canonical database', () => {
    const manifest = createHomebaseManifest();
    manifest.services = manifest.services.map((service) =>
      service.kind === 'database' ? { ...service, persistence: 'ephemeral' as const } : service,
    );
    const result = validatePortableInfrastructure(manifest);
    expect(result.admissible).toBe(false);
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        'CANONICAL_DATABASE_CANNOT_BE_EPHEMERAL',
        'CANONICAL_SERVICE_EPHEMERAL:postgres-homebase',
      ]),
    );
  });
});
