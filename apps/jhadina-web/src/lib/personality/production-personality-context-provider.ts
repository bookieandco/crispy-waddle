import {
  decideBehavior,
  emptyPersonalityState,
  planExpression,
  runPersonalityBehaviorRuntime,
  type BehavioralKernelContext,
  type Experience,
  type ExpressionDirective,
  type PatternObservation,
  type PersonalityEligibilityRule,
  type PersonalityState,
  type PersonalityStateRepository,
} from "@jhadina/core-spine"
import type { MemoryStorage } from "../storage/MemoryStorage"
import { PersistedExperiencePatternAdapter } from "../hippocampus/persisted-experience-pattern-adapter"
import { createSupabasePersonalityStateRepository } from "./supabase-personality-state-repository"

export interface PersonalityContextInput {
  userId: string
  activeTask: string
  occurredAt?: string
  behaviorContext?: BehavioralKernelContext
}

export interface PersonalityContextContribution {
  patterns: PatternObservation[]
  personality: PersonalityState
  expressionDirective: ExpressionDirective
  limitations: string[]
}

export interface ProductionPersonalityContextProviderOptions {
  repository?: PersonalityStateRepository | null
  eligibilityRules?: readonly PersonalityEligibilityRule[]
}

/**
 * Read/governed production adapter for Ask Jhadina.
 *
 * It composes the existing durable MemoryStorage/Hippocampus path with the
 * governed Pattern -> eligibility -> Personality -> RNC -> Behavior ->
 * Expression pipeline. It never writes an episodic record and never lets the
 * model mutate personality. Personality persistence is versioned through the
 * injected repository when available.
 */
export class ProductionPersonalityContextProvider {
  private readonly adapter: PersistedExperiencePatternAdapter
  private readonly repository: PersonalityStateRepository | null
  private readonly eligibilityRules: readonly PersonalityEligibilityRule[]

  constructor(
    storage: MemoryStorage,
    options: ProductionPersonalityContextProviderOptions = {},
  ) {
    this.adapter = new PersistedExperiencePatternAdapter(storage)
    this.repository = options.repository ?? null
    this.eligibilityRules = options.eligibilityRules ?? []
  }

  async getContext(
    input: PersonalityContextInput,
  ): Promise<PersonalityContextContribution> {
    const occurredAt = input.occurredAt ?? new Date().toISOString()
    const experience = createLiveExperience(input.userId, input.activeTask, occurredAt)
    const detected = await this.adapter.detectExperience({
      userId: input.userId,
      experience,
    })

    const limitations: string[] = []
    let current = emptyPersonalityState(new Date(0).toISOString())

    if (this.repository) {
      try {
        current = await this.repository.load()
      } catch {
        limitations.push(
          "personality durable state unavailable — canonical empty state used",
        )
      }
    } else {
      limitations.push(
        "personality persistence unavailable — canonical empty state used; no personality mutation performed",
      )
    }

    const runtime = runPersonalityBehaviorRuntime({
      personality: current,
      patterns: detected.patterns,
      memories: detected.memories,
      eligibilityRules: this.eligibilityRules,
      behaviorContext: input.behaviorContext,
      now: occurredAt,
    })

    let personality = runtime.personality
    let expressionDirective: ExpressionDirective = runtime.expression

    if (this.repository && runtime.personality.version !== current.version) {
      try {
        await this.repository.save(current.version, runtime.personality)
      } catch {
        limitations.push(
          "personality update was not persisted — prior durable state retained",
        )
        personality = current
        const behavior = decideBehavior(current, input.behaviorContext)
        expressionDirective = planExpression(behavior)
      }
    }

    return {
      patterns: runtime.patterns,
      personality,
      expressionDirective,
      limitations,
    }
  }
}

function createLiveExperience(
  userId: string,
  activeTask: string,
  occurredAt: string,
): Experience {
  const id = `ask-jhadina-live:${crypto.randomUUID()}`

  return {
    id,
    occurredAt,
    source: "ask-jhadina",
    actor: "user",
    content: activeTask,
    provenance: {
      persistence: "live-unpersisted",
      userId,
    },
    evidence: [{
      id,
      source: "ask-jhadina",
      observedAt: occurredAt,
      summary: activeTask,
      immutable: false,
    }],
  }
}

export function createProductionPersonalityContextProvider(
  storage: MemoryStorage,
  userId: string,
): ProductionPersonalityContextProvider {
  return new ProductionPersonalityContextProvider(storage, {
    repository: createSupabasePersonalityStateRepository(userId),
  })
}
