import type { CreativeBody, CreativeCTA, CreativeHook, CreativeDNA } from './creative-dna.js'

export type CreativeVariant = {
  id: string
  opportunityId: string
  creativeDnaId: string
  hook: CreativeHook
  body: CreativeBody
  cta: CreativeCTA
  status: 'draft' | 'approved' | 'scheduled' | 'published' | 'measured' | 'rejected'
}

export type ExperimentMatrix = {
  id: string
  opportunityId: string
  creativeDnaId: string
  variants: CreativeVariant[]
  requiresApproval: boolean
}

export function buildExperimentMatrix(dna: CreativeDNA): ExperimentMatrix {
  const variants: CreativeVariant[] = []
  for (const hook of dna.hooks) {
    for (const body of dna.bodies) {
      for (const cta of dna.ctas) {
        variants.push({
          id: `${dna.id}:${variants.length + 1}`,
          opportunityId: dna.opportunityId,
          creativeDnaId: dna.id,
          hook,
          body,
          cta,
          status: 'draft',
        })
      }
    }
  }
  return { id: `matrix-${dna.id}`, opportunityId: dna.opportunityId, creativeDnaId: dna.id, variants, requiresApproval: true }
}
