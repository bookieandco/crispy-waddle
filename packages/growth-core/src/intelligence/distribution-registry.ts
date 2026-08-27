import type { DistributionSurface, GrowthSurfaceKind } from './distribution-opportunity.js';

export interface DistributionSurfaceDefinition {
  id: string;
  kind: GrowthSurfaceKind;
  name: string;
  capabilities: DistributionSurface['capabilities'];
}

const DEFAULT_SURFACES: readonly DistributionSurfaceDefinition[] = [
  { id: 'social:instagram', kind: 'social', name: 'Instagram', capabilities: ['listen', 'publish', 'engage', 'measure'] },
  { id: 'social:tiktok', kind: 'social', name: 'TikTok', capabilities: ['listen', 'publish', 'engage', 'measure'] },
  { id: 'social:youtube', kind: 'social', name: 'YouTube', capabilities: ['listen', 'publish', 'measure'] },
  { id: 'social:facebook', kind: 'social', name: 'Facebook', capabilities: ['listen', 'publish', 'engage', 'paid', 'measure'] },
  { id: 'social:x', kind: 'social', name: 'X', capabilities: ['listen', 'publish', 'engage', 'measure'] },
  { id: 'search:google', kind: 'search', name: 'Google Search', capabilities: ['listen', 'paid', 'measure'] },
  { id: 'search:ai', kind: 'search', name: 'AI Search', capabilities: ['listen', 'measure'] },
  { id: 'community:reddit', kind: 'community', name: 'Reddit', capabilities: ['listen', 'engage', 'measure'] },
  { id: 'creator:network', kind: 'creator', name: 'Creator Network', capabilities: ['listen', 'engage', 'measure'] },
  { id: 'email:lifecycle', kind: 'email', name: 'Lifecycle Email', capabilities: ['publish', 'measure'] },
  { id: 'paid:multi', kind: 'paid', name: 'Paid Media', capabilities: ['publish', 'paid', 'measure'] },
  { id: 'partnership:network', kind: 'partnership', name: 'Partnerships', capabilities: ['listen', 'engage', 'measure'] },
  { id: 'marketplace:discovery', kind: 'marketplace', name: 'Marketplaces & Directories', capabilities: ['listen', 'publish', 'measure'] },
];

export function defaultDistributionSurfaces(): DistributionSurface[] {
  return DEFAULT_SURFACES.map((surface) => ({ ...surface, enabled: true }));
}

export function getDistributionSurface(id: string): DistributionSurface | undefined {
  const surface = DEFAULT_SURFACES.find((item) => item.id === id);
  return surface ? { ...surface, enabled: true } : undefined;
}
