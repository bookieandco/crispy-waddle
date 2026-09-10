import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationService } from '@jhadina/director-core/generation-service';
import { GenerationPlanAdapter } from '@jhadina/director-core/generation-plan-adapter';
import { GenerationSubmissionReconciler } from '@jhadina/director-core/generation-submission-reconciler';
import { OutboxGenerationProvider } from '@jhadina/director-core/outbox-generation-provider';
import type { GenerationRegistry } from '@jhadina/director-core/generation-registry';
import { createSupabaseGeneratedAssetRepository } from './supabase-generated-asset-repository';
import { createSupabaseGenerationRepository } from '../src/lib/supabase-generation-repository';
import {
  createDirectorGenerationRegistryAndProviders,
  type DirectorGenerationFactoryConfig,
} from '../src/lib/director-generation-provider-factory';

export type DirectorGenerationRuntime = {
  /** Governed Director submission surface. Raw GenerationService is intentionally not exposed. */
  generation: GenerationPlanAdapter;
  reconciler: GenerationSubmissionReconciler;
  workerId: string;
};

function composeDirectorGenerationRuntime(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
  workerId: string,
): DirectorGenerationRuntime {
  const repository = createSupabaseGenerationRepository(client);
  const outboxProviders = new Map<string, GenerationProvider>();
  for (const [providerId, provider] of providers) {
    outboxProviders.set(providerId, new OutboxGenerationProvider(provider, repository, workerId));
  }

  const service = new GenerationService(
    registry,
    outboxProviders,
    createSupabaseGeneratedAssetRepository(client),
    repository,
    workerId,
  );
  const generation = new GenerationPlanAdapter(service, registry);
  const reconciler = new GenerationSubmissionReconciler(repository, outboxProviders, workerId);
  return { generation, reconciler, workerId };
}

/**
 * Canonical server composition root for production Director generation.
 * Provider construction comes exclusively from the configured provider factory,
 * so HTTP generation and reconciliation cannot silently assemble different runtimes.
 *
 * The raw GenerationService is deliberately kept private to this composition root.
 * Production callers receive only the governed GenerationPlanAdapter, whose
 * submitTake() requires a bound, approved Creative Gate before provider submission.
 */
export function createConfiguredDirectorGenerationRuntime(
  client: SupabaseClient,
  config?: DirectorGenerationFactoryConfig,
  workerId = `director-worker:${Math.random().toString(36).slice(2)}`,
): DirectorGenerationRuntime {
  const { registry, providers } = createDirectorGenerationRegistryAndProviders(config);
  return composeDirectorGenerationRuntime(client, registry, providers, workerId);
}

/**
 * Explicit-injection composition retained for unit/integration tests and
 * specialized adapters that already own their provider registry.
 */
export function createDirectorGenerationRuntime(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
  workerId = `director-worker:${Math.random().toString(36).slice(2)}`,
): DirectorGenerationRuntime {
  return composeDirectorGenerationRuntime(client, registry, providers, workerId);
}
