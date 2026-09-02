import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationService } from '@jhadina/director-core/generation-service';
import { GenerationSubmissionReconciler } from '@jhadina/director-core/generation-submission-reconciler';
import { OutboxGenerationProvider } from '@jhadina/director-core/outbox-generation-provider';
import type { GenerationRegistry } from '@jhadina/director-core/generation-registry';
import { createSupabaseGeneratedAssetRepository } from './supabase-generated-asset-repository';
import { createSupabaseGenerationRepository } from '../src/lib/supabase-generation-repository';

export type DirectorGenerationRuntime = {
  service: GenerationService;
  reconciler: GenerationSubmissionReconciler;
  workerId: string;
};

/** Server composition root for generation and durable submission reconciliation. */
export function createDirectorGenerationRuntime(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
  workerId = `director-worker:${Math.random().toString(36).slice(2)}`,
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
  const reconciler = new GenerationSubmissionReconciler(repository, outboxProviders, workerId);
  return { service, reconciler, workerId };
}

/** Backward-compatible service-only composition for request handlers. */
export function createDirectorGenerationService(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
): GenerationService {
  return createDirectorGenerationRuntime(client, registry, providers).service;
}
