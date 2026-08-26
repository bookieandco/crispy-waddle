import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationService } from '@jhadina/director-core/generation-service';
import type { GenerationRegistry } from '@jhadina/director-core/generation-registry';
import { createSupabaseGeneratedAssetRepository } from './supabase-generated-asset-repository';

/**
 * Server composition root for generation. Keeping the repository injection here
 * means every completed provider output can flow into the same durable asset
 * registry consumed by the workstation feed.
 */
export function createDirectorGenerationService(
  client: SupabaseClient,
  registry: GenerationRegistry,
  providers: Map<string, GenerationProvider>,
): GenerationService {
  return new GenerationService(
    registry,
    providers,
    createSupabaseGeneratedAssetRepository(client),
  );
}
