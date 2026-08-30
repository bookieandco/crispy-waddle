import { updateSharkCausalAttribution } from './causal-attribution-updater'

describe('SHARK 1.41-D causal attribution updating', () => {
  const hypothesis = {
    hypothesisId: 'h1', statement: 'liquidity conditions contributed to outcome', confidence: 0.5,
    supportingExperienceIds: [], contradictingExperienceIds: [], updateCount: 0,
  }

  it('strengthens a causal hypothesis when later evidence supports it', () => {
    const result = updateSharkCausalAttribution({ hypothesis, experienceId: 'e1', supports: true, strength: 0.2 })
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.supportingExperienceIds).toEqual(['e1'])
    expect(result.updateCount).toBe(1)
  })

  it('weakens a causal hypothesis when later evidence contradicts it', () => {
    const result = updateSharkCausalAttribution({ hypothesis, experienceId: 'e2', supports: false, strength: 0.2 })
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.contradictingExperienceIds).toEqual(['e2'])
  })

  it('moves an experience between support and contradiction when evidence changes', () => {
    const supported = updateSharkCausalAttribution({ hypothesis, experienceId: 'e3', supports: true, strength: 0.1 })
    const contradicted = updateSharkCausalAttribution({ hypothesis: supported, experienceId: 'e3', supports: false, strength: 0.1 })
    expect(contradicted.supportingExperienceIds).not.toContain('e3')
    expect(contradicted.contradictingExperienceIds).toContain('e3')
  })

  it('caps confidence and preserves explicit update history', () => {
    const result = updateSharkCausalAttribution({ hypothesis: { ...hypothesis, confidence: 0.99 }, experienceId: 'e4', supports: true, strength: 1 })
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.updateCount).toBe(1)
  })
})
