import type { GrowthId, ISODateTime, Provenance } from '../domain/types.js';
import { normalizeKnowledgeInput, type KnowledgeInput, type KnowledgeSourceKind } from './ingestion.js';

export interface KnowledgeSourceDescriptor {
  id: GrowthId;
  kind: KnowledgeSourceKind;
  uri?: string;
  title?: string;
  capturedAt: ISODateTime;
  provenance: Provenance;
}

export interface KnowledgeSourceAdapter {
  readonly kind: KnowledgeSourceKind;
  canHandle(descriptor: KnowledgeSourceDescriptor): boolean;
  fetch(descriptor: KnowledgeSourceDescriptor): Promise<KnowledgeInput>;
}

export interface KnowledgeAdapterRegistry {
  register(adapter: KnowledgeSourceAdapter): void;
  resolve(descriptor: KnowledgeSourceDescriptor): KnowledgeSourceAdapter | undefined;
  ingest(descriptor: KnowledgeSourceDescriptor): Promise<KnowledgeInput>;
}

export function createKnowledgeAdapterRegistry(
  adapters: readonly KnowledgeSourceAdapter[] = [],
): KnowledgeAdapterRegistry {
  const registry = new Map<KnowledgeSourceKind, KnowledgeSourceAdapter>();
  for (const adapter of adapters) registry.set(adapter.kind, adapter);

  return {
    register(adapter) {
      registry.set(adapter.kind, adapter);
    },
    resolve(descriptor) {
      const adapter = registry.get(descriptor.kind);
      return adapter?.canHandle(descriptor) ? adapter : undefined;
    },
    async ingest(descriptor) {
      const adapter = this.resolve(descriptor);
      if (!adapter) {
        throw new Error(`No knowledge adapter registered for ${descriptor.kind}`);
      }
      return normalizeKnowledgeInput(await adapter.fetch(descriptor));
    },
  };
}
