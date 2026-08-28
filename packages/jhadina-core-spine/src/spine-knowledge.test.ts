import { JhadinaSpine } from './spine.js'
import { InMemoryKnowledgeRepository } from './knowledge-repository.js'
import type { ActionPort, AuditPort, ContextPort, DecisionPort, MemoryPort, PatternPort, PersonalityPort, PolicyPort } from './spine.js'
import type { ActionRequest, ActionResult, ContextPacket, DecisionProposal, Experience, MemoryProposal, PatternObservation, PersonalityState, PolicyDecision } from './types.js'
import type { EvolutionPort } from './evolution.js'
import type { ImprovementInput, ImprovementProposal } from './evolution.js'

const experience: Experience = {
  id: 'experience-1',
  occurredAt: '2026-08-28T00:00:00.000Z',
  source: 'test',
  actor: 'user',
  content: 'SAM opportunity research',
  evidence: [],
}

const memory: MemoryProposal = { id: 'memory-1', content: 'prior context', reason: 'test', evidence: [], disposition: 'SAVE' }
const pattern: PatternObservation = { id: 'pattern-1', pattern: 'research intent', evidence: [], confidence: 1, occurrences: 1, contradictions: [], lastObservedAt: experience.occurredAt }
const personality: PersonalityState = { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: experience.occurredAt }
const actionRequest: ActionRequest = { id: 'action-1', proposalId: 'decision-1', capability: 'test', operation: 'noop', input: null, reversible: true, consequenceLevel: 'low' }
const actionResult: ActionResult = { id: 'result-1', requestId: actionRequest.id, success: true, completedAt: experience.occurredAt }
const decision: DecisionProposal = { id: 'decision-1', contextId: 'context-1', disposition: 'PROCEED', recommendation: 'continue', rationale: 'test', evidence: [], uncertainty: [], alternatives: [] }
const policy: PolicyDecision = { id: 'policy-1', proposalId: decision.id, allowed: false, reason: 'test', requiredApproval: false, evaluatedAt: experience.occurredAt }

const memoryPort: MemoryPort = { observe: async () => [memory], loadRelevant: async () => [] }
const patternPort: PatternPort = { detect: async () => [pattern] }
const personalityPort: PersonalityPort = { build: async () => personality }
const contextPort: ContextPort = {
  build: async (input): Promise<ContextPacket> => {
    if (input.knowledge.length !== 1) throw new Error('Expected retrieved knowledge in context')
    if (input.knowledge[0]?.claim !== 'SAM opportunity requires research') throw new Error('Expected knowledge claim in context')
    return { id: 'context-1', purpose: 'test', relevantMemories: [], patterns: input.patterns, personality: input.personality, knowledge: [], constraints: [], excludedContext: [] }
  },
}
const decisionPort: DecisionPort = { decide: async () => decision }
const policyPort: PolicyPort = { evaluate: async () => policy }
const actionPort: ActionPort = {
  prepare: async () => actionRequest,
  execute: async () => actionResult,
}
const auditPort: AuditPort = { record: async () => undefined }
const evolutionPort: EvolutionPort = { analyze: async (_input: ImprovementInput): Promise<ImprovementProposal> => ({ id: 'proposal-1', status: 'PROPOSED' } as ImprovementProposal) }

export async function regression_spine_retrieves_knowledge_before_context(): Promise<void> {
  const knowledge = new InMemoryKnowledgeRepository()
  await knowledge.ingest({
    id: 'knowledge-1',
    subject: 'SAM opportunity',
    claim: 'SAM opportunity requires research',
    confidence: 0.9,
    evidence: [],
    createdAt: experience.occurredAt,
    updatedAt: experience.occurredAt,
  })

  const spine = new JhadinaSpine({ memory: memoryPort, pattern: patternPort, personality: personalityPort, context: contextPort, decision: decisionPort, policy: policyPort, action: actionPort, audit: auditPort, evolution: evolutionPort, knowledge })
  await spine.run(experience)
}
