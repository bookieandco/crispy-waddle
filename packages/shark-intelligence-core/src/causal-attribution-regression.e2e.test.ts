import { updateSharkCausalAttribution } from './causal-attribution-updater'

describe('SHARK 1.41-E final causal/provenance regression', () => {
  const base = { hypothesisId: 'h1', statement: 'liquidity conditions contributed to outcome', confidence: 0.5, supportingExperienceIds: [], contradictingExperienceIds: [], updateCount: 0 }

  it('accumulates independent support without rewriting the hypothesis', () => {
    const one = updateSharkCausalAttribution({ hypothesis: base, experienceId: 'e1', supports: true, strength: 0.1 })
    const two = updateSharkCausalAttribution({ hypothesis: one, experienceId: 'e2', supports: true, strength: 0.1 })
    expect(two.statement).toBe(base.statement)
    expect(two.supportingExperienceIds).toEqual(['e1', 'e2'])
    expect(two.updateCount).toBe(2)
    expect(two.confidence).toBeGreaterThan(one.confidence)
  })

  it('retains contradiction while reducing causal confidence', () => {
    const result = updateSharkCausalAttribution({ hypothesis: { ...base, confidence: 0.8 }, experienceId: 'e3', supports: false, strength: 0.2 })
    expect(result.contradictingExperienceIds).toContain('e3')
    expect(result.confidence).toBeLessThan(0.8)
  })

  it('keeps history attributable across support reversal', () => {
    const supported = updateSharkCausalAttribution({ hypothesis: base, experienceId: 'e4', supports: true })
    const reversed = updateSharkCausalAttribution({ hypothesis: supported, experienceId: 'e4', supports: false })
    expect(reversed.supportingExperienceIds).not.toContain('e4')
    expect(reversed.contradictingExperienceIds).toContain('e4')
    expect(reversed.updateCount).toBe(2)
  })
})
