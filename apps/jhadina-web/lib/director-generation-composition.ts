import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationService } from '@jhadina/director-core/generation-service';
import { OutboxGenerationProvider } from '@jhadina/director-core/outbox-generation-provider';
import type { GenerationRegistry } from '@jhadina/director-core/generation-registry';
import { createSupabaseGeneratedAssetRepository } from './supabase-generated-asset-repository';
import { createSupabaseGenerationRepository } from '../src/lib/supabase-generation-repository';

/**
 * Server composition root for generation. Every production provider is wrapped
 * by the durable submission outbox before it is exposed to GenerationService.
 */
export function createDirectorGenerationService(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
): GenerationService {
  const repository = createSupabaseGenerationRepository(client);
  const workerId = `director-worker:${Math.random().toString(36).slice(2)}`;
  const outboxProviders = new Map<string, GenerationProvider>();
  for (const [providerId, provider] of providers) {
    outboxProviders.set(providerId, new OutboxGenerationProvider(provider, repository, workerId));
  }

  return new GenerationService(
    registry,
    outboxProviders,
    createSupabaseGeneratedAssetRepository(client),
    repository,
    workerId,
  );
}
