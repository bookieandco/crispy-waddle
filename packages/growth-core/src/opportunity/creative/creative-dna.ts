export type CreativeHook = {
  text: string
  angle?: string
  sourceOpportunityId?: string
}

export type CreativeBody = {
  structure: string
  proof?: string
  benefit?: string
}

export type CreativeCTA = {
  text: string
  action: 'learn_more' | 'click' | 'buy' | 'apply' | 'contact' | 'test'
}

export type CreativeDNA = {
  id: string
  opportunityId: string
  audience: string
  pain: string
  discovery: string
  demonstration: string
  benefit: string
  socialProof?: string
  hooks: CreativeHook[]
  bodies: CreativeBody[]
  ctas: CreativeCTA[]
  sourceEvidenceIds: string[]
  createdAt: string
  updatedAt: string
}

export type CreativeExperiment = {
  id: string
  opportunityId: string
  creativeDnaId: string
  combinations: number
  status: 'draft' | 'ready' | 'running' | 'completed'
  requiresApproval: boolean
}

export function creativeCombinationCount(dna: Pick<CreativeDNA, 'hooks' | 'bodies' | 'ctas'>): number {
  return dna.hooks.length * dna.bodies.length * dna.ctas.length
}

export function createCreativeExperiment(dna: CreativeDNA): CreativeExperiment {
  return {
    id: `creative-exp-${dna.id}`,
    opportunityId: dna.opportunityId,
    creativeDnaId: dna.id,
    combinations: creativeCombinationCount(dna),
    status: 'draft',
    requiresApproval: true,
  }
}
