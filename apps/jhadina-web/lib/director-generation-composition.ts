import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationService } from '@jhadina/director-core/generation-service';
import type { GenerationRegistry } from '@jhadina/director-core/generation-registry';
import { createSupabaseGeneratedAssetRepository } from './supabase-generated-asset-repository';
import { createSupabaseGenerationRepository } from '../src/lib/supabase-generation-repository';

/**
 * Server composition root for generation. Every generation now persists both
 * its canonical task/execution state and completed generated assets through
 * the same privileged Supabase client.
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
    createSupabaseGenerationRepository(client),
  );
}
