import type { ActionHandler } from './core-adapters';
import type { DomainId, DomainManifest } from './contracts';
import { DOMAIN_MANIFESTS } from './contracts';

export type ImplementationStatus = 'active' | 'ready-to-wire' | 'external-branch';

export interface OsImplementationRegistration {
  domain: DomainId;
  displayName: string;
  status: ImplementationStatus;
  packageName?: string;
  appSurface?: string;
  sourceRef?: string;
  capabilities: readonly string[];
  handler?: ActionHandler;
}

/**
 * Canonical registration record for every Jhadina OS/domain.
 *
 * Existing implementations that are already on main are marked active.
 * Implementations living on open feature branches are recorded as
 * external-branch so the integration layer can be merged independently
 * without pretending those branches are already part of main.
 */
export const EXISTING_OS_REGISTRATIONS: readonly OsImplementationRegistration[] = [
  {
    domain: 'musicos',
    displayName: 'MusicOS',
    status: 'active',
    packageName: '@jhadina/music-core',
    appSurface: 'apps/jhadina-web/src/app/music',
    sourceRef: 'main:packages/music-core',
    capabilities: ['catalog', 'search', 'discovery', 'playback', 'taste', 'restoration', 'production', 'mixing', 'mastering'],
  },
  {
    domain: 'directoros',
    displayName: 'DirectorOS',
    status: 'external-branch',
    packageName: '@jhadina/shotlist-core',
    sourceRef: 'feat/jhadina-shotlist-director-integration (PR #8)',
    capabilities: ['screenplay', 'storyboard', 'shot-list', 'camera', 'lighting', 'takes', 'continuity', 'assembly', 'editing'],
  },
  {
    domain: 'campaignos',
    displayName: 'CampaignOS',
    status: 'ready-to-wire',
    capabilities: ['geography', 'election-data', 'research', 'organizing', 'communications', 'reels', 'ads'],
  },
  {
    domain: 'overageos',
    displayName: 'OverageOS',
    status: 'ready-to-wire',
    capabilities: ['surplus-discovery', 'public-records-search', 'verification', 'heir-research', 'claim-workflow', 'outreach'],
  },
  {
    domain: 'tvos',
    displayName: 'Jhadina TVOS',
    status: 'ready-to-wire',
    capabilities: ['discovery', 'research', 'watch-history-context', 'production', 'distribution'],
  },
  {
    domain: 'podcastos',
    displayName: 'PodcastOS',
    status: 'ready-to-wire',
    capabilities: ['research', 'evidence-map', 'deep-dive', 'screenplay', 'recording', 'editing', 'clips'],
  },
  {
    domain: 'commerce',
    displayName: 'Commerce',
    status: 'external-branch',
    appSurface: 'apps/pupsonstuff',
    sourceRef: 'pupsonstuff-import (PR #9)',
    capabilities: ['product-discovery', 'product-research', 'pupsonstuff', 'product-preview', 'ad-generation', 'reels', 'shop-content'],
  },
  {
    domain: 'creator-workstation',
    displayName: 'Creator Workstation',
    status: 'ready-to-wire',
    capabilities: ['project', 'timeline', 'canvas', 'audio-mixer', 'storyboard', 'review', 'export', 'complete-document'],
  },
];

export interface OsRegistry {
  register(registration: OsImplementationRegistration): void;
  get(domain: DomainId): OsImplementationRegistration | undefined;
  list(): readonly OsImplementationRegistration[];
  handlers(): readonly ActionHandler[];
}

export class InMemoryOsRegistry implements OsRegistry {
  private readonly registrations = new Map<DomainId, OsImplementationRegistration>();

  constructor(seed: readonly OsImplementationRegistration[] = EXISTING_OS_REGISTRATIONS) {
    for (const registration of seed) this.register(registration);
  }

  register(registration: OsImplementationRegistration): void {
    if (this.registrations.has(registration.domain)) {
      throw new Error(`OS already registered: ${registration.domain}`);
    }
    this.registrations.set(registration.domain, registration);
  }

  get(domain: DomainId): OsImplementationRegistration | undefined {
    return this.registrations.get(domain);
  }

  list(): readonly OsImplementationRegistration[] {
    return [...this.registrations.values()];
  }

  handlers(): readonly ActionHandler[] {
    return this.list().flatMap((registration) => registration.handler ? [registration.handler] : []);
  }
}

export interface RegistrySnapshot {
  domains: readonly DomainManifest[];
  implementations: readonly OsImplementationRegistration[];
  activeDomains: readonly DomainId[];
  pendingDomains: readonly DomainId[];
}

export function createOsRegistrySnapshot(registry: OsRegistry = new InMemoryOsRegistry()): RegistrySnapshot {
  const implementations = registry.list();
  return {
    domains: DOMAIN_MANIFESTS,
    implementations,
    activeDomains: implementations.filter((item) => item.status === 'active').map((item) => item.domain),
    pendingDomains: implementations.filter((item) => item.status !== 'active').map((item) => item.domain),
  };
}
