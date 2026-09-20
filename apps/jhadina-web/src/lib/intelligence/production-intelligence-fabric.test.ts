import { describe, expect, it } from 'vitest'
import type { ContextPacket } from '@jhadina/core-spine'
import { buildIntelligenceRetrievalText } from './production-intelligence-fabric'

const packet = (overrides: Partial<ContextPacket> = {}): ContextPacket => ({
  id: 'ctx-1',
  purpose: 'fallback purpose',
  relevantMemories: [],
  patterns: [],
  personality: { version: 1, traits: [], independentAssessmentRequired: false, updatedAt: '2026-01-01T00:00:00.000Z' },
  knowledge: [],
  constraints: [],
  excludedContext: [],
  ...overrides,
})

describe('buildIntelligenceRetrievalText', () => {
  it('uses the canonical userGoal when present', () => {
    expect(buildIntelligenceRetrievalText(packet({ userGoal: '  find my saved research  ' }))).toBe('find my saved research')
  })

  it('falls back to purpose when userGoal is absent or blank', () => {
    expect(buildIntelligenceRetrievalText(packet())).toBe('fallback purpose')
    expect(buildIntelligenceRetrievalText(packet({ userGoal: '   ' }))).toBe('fallback purpose')
  })
})
