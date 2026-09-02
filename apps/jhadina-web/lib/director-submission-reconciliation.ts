import type { SupabaseClient } from '@supabase/supabase-js';
import type { GenerationProvider } from '@jhadina/director-core/generation-provider';
import { GenerationSubmissionReconciler, type GenerationSubmissionReconciliationResult } from '@jhadina/director-core/generation-submission-reconciler';
import { createSupabaseGenerationRepository } from '../src/lib/supabase-generation-repository';

/**
 * Server-only entrypoint used by a scheduler/cron adapter. Provider construction
 * remains owned by the production composition root so this worker cannot invent
 * an incomplete provider configuration.
 */
export async function runDirectorSubmissionReconciliation(
  client: SupabaseClient,
  providers: ReadonlyMap<string, GenerationProvider>,
  options: { workerId?: string; limit?: number; leaseMs?: number } = {},
): Promise<GenerationSubmissionReconciliationResult> {
  const workerId = options.workerId ?? `director-reconciler:${Math.random().toString(36).slice(2)}`;
  const repository = createSupabaseGenerationRepository(client);
  const reconciler = new GenerationSubmissionReconciler(repository, providers, workerId, options.leaseMs ?? 30_000);
  return reconciler.runOnce(options.limit ?? 25);
}
