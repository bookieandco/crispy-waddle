import { Classifier } from "../services/Classifier"
import { JanetService } from "../services/JanetService"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"

export interface JhadinaApplication {
  storage: InMemoryStorage
  memoryRepo: MemoryRepository
  reasoningRepo: ReasoningEventRepository
  timelineRepo: TimelineRepository
  janet: JanetService
}

export function createJhadinaApplication(): JhadinaApplication {
  const storage = new InMemoryStorage()
  const memoryRepo = new MemoryRepository(storage)
  const reasoningRepo = new ReasoningEventRepository(storage)
  const timelineRepo = new TimelineRepository(storage)
  const janet = new JanetService(
    new Classifier(),
    memoryRepo,
    reasoningRepo,
    timelineRepo,
  )

  return {
    storage,
    memoryRepo,
    reasoningRepo,
    timelineRepo,
    janet,
  }
}

let application: JhadinaApplication | undefined

/**
 * Returns the process-local application graph. This keeps all route handlers
 * in the same runtime instance on long-lived Node/serverless workers while
 * remaining replaceable through createJhadinaApplication() in tests.
 */
export function getJhadinaApplication(): JhadinaApplication {
  if (!application) application = createJhadinaApplication()
  return application
}
