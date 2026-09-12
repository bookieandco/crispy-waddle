import { Classifier } from "../services/Classifier"
import { JanetService } from "../services/JanetService"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { createMemoryStorage } from "../storage/createMemoryStorage"
import { InMemoryRegretMemory } from "@jhadina/core-spine"
import { JanetRegretContextAdapter, type JanetRegretContextProvider } from "../intelligence/janet-regret-context"
import {
  SupabaseActionIdentityVerifier,
  type JhadinaIdentityVerifier,
  type SupabaseClaimsClient,
} from "../auth/supabase-identity-verifier"

export type ExecutionReadiness =
  | { status: "ready"; executor: unknown }
  | {
      status: "not_configured"
      executor: null
      missing: readonly ("identity" | "policy" | "handlers" | "audit")[]
    }

export interface JhadinaApplication {
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  regretContextProvider: JanetRegretContextProvider
  janet: JanetService
  identity: {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier
  }
  execution: ExecutionReadiness
}

export function createJhadinaApplication(): JhadinaApplication {
  const storage = createMemoryStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const timelineRepo = new TimelineRepository(storage)

  // Regret Memory is process-scoped here so repeated commands share the same
  // governed recall surface. It is intentionally not presented as durable
  // persistence; a durable regret store is a separate follow-up gate.
  const regretMemory = new InMemoryRegretMemory()
  const regretContextProvider = new JanetRegretContextAdapter(regretMemory)

  const janet = new JanetService(
    new Classifier(),
    memoryRepo,
    reasoningRepo,
    timelineRepo,
  )

  const identity = {
    createVerifier(supabase: SupabaseClaimsClient): JhadinaIdentityVerifier {
      return new SupabaseActionIdentityVerifier(supabase)
    },
  }

  const execution: ExecutionReadiness = {
    status: "not_configured",
    executor: null,
    missing: ["identity", "policy", "handlers", "audit"],
  }

  return {
    memoryRepo,
    reasoningRepo,
    timelineRepo,
    regretContextProvider,
    janet,
    identity,
    execution,
  }
}

let application: JhadinaApplication | undefined

/**
 * Returns the process-local application graph. Storage is intentionally
 * private to the composition root; callers receive governed repositories,
 * never raw persistence capabilities.
 */
export function getJhadinaApplication(): JhadinaApplication {
  if (!application) application = createJhadinaApplication()
  return application
}
