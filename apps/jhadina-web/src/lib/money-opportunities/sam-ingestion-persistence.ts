import type { Opportunity } from '@jhadina/opportunity-core'
import { createRequestIdentityVerifier } from '@/lib/auth/request-identity'
import { createSupabaseOpportunityRepository } from '@/lib/opportunities/supabase-opportunity-repository'

export async function persistCanonicalSamOpportunities(
  opportunities: Opportunity[],
): Promise<{ userId: string; persistedIds: string[] }> {
  const identityVerifier = await createRequestIdentityVerifier()
  const identity = await identityVerifier.verify({})
  const repository = createSupabaseOpportunityRepository()
  const persistedIds:string[]=[]
  for(const opportunity of opportunities){
    if(opportunity.type!=='contract'||opportunity.sourceId!=='us.sam.gov'){
      throw new Error('Only canonical SAM.gov contract opportunities may use SAM ingestion persistence')
    }
    await repository.upsert(identity.userId,opportunity,'review')
    persistedIds.push(opportunity.id)
  }
  return {userId:identity.userId,persistedIds}
}
