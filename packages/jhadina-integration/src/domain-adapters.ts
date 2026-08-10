import type { ActionAdapter, ExecutionContext } from './action-executor';
import type { DomainId } from './contracts';

export interface DomainCapabilityImplementation {
  domain: DomainId;
  capability: string;
  execute(input: unknown, context: ExecutionContext): Promise<unknown>;
}

export function createDomainAdapters(implementations: readonly DomainCapabilityImplementation[]): ActionAdapter[] {
  return implementations.map((implementation) => ({
    domain: implementation.domain,
    capability: implementation.capability,
    execute: implementation.execute,
  }));
}

/** Standard adapter registration point for every OS. Keep domain code behind this boundary. */
export function registerDomainImplementation(
  target: DomainCapabilityImplementation[],
  implementation: DomainCapabilityImplementation,
): void {
  if (target.some((item) => item.domain === implementation.domain && item.capability === implementation.capability)) {
    throw new Error(`Duplicate capability registration: ${implementation.domain}:${implementation.capability}`);
  }
  target.push(implementation);
}

export const OS_ADAPTER_CAPABILITY_TEMPLATE: Record<DomainId, readonly string[]> = {
  directoros: ['project.create', 'take.generate', 'take.regenerate', 'project.export', 'public.publish'],
  campaignos: ['research.run', 'geography.lookup', 'content.generate', 'reel.generate', 'ad.generate', 'public.publish'],
  overageos: ['surplus.discovery', 'public-records.search', 'verification.run', 'outreach.prepare', 'claim.export'],
  commerce: ['product.discover', 'product.research', 'ad.generate', 'reel.generate', 'shop-content.generate', 'paid-ad.publish'],
  tvos: ['discovery.search', 'watch-context.record', 'project.create', 'content.generate', 'public.publish'],
  podcastos: ['research.run', 'evidence-map.create', 'episode.create', 'script.generate', 'clip.generate', 'public.publish'],
  musicos: ['catalog.search', 'playback.play', 'playback.pause', 'playback.resume', 'playback.next', 'playback.previous', 'playback.status', 'audio.outputs', 'audio.select-output'],
  'creator-workstation': ['project.create', 'asset.import', 'project.edit', 'project.export', 'public.publish'],
};
