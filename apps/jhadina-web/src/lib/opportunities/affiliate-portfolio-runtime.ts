import {
  isSideHustleProfile,
  summarizeSideHustleAffiliatePortfolio,
  type SideHustleAffiliateEvent,
  type SideHustleAffiliatePortfolioTruth,
} from '@jhadina/opportunity-core'
import type { SideHustleCommercePersistence } from './side-hustle-commerce-runtime'

export async function summarizeAffiliatePortfolioRuntime(
  input:{opportunityId:string},
  repository:SideHustleCommercePersistence,
):Promise<SideHustleAffiliatePortfolioTruth>{
  const opportunityId=requireText(input.opportunityId,'opportunityId')
  const stored=await repository.get(opportunityId)
  if(!stored)throw new Error('AFFILIATE_PORTFOLIO_OPPORTUNITY_NOT_FOUND')

  const profile=stored.opportunity.metadata?.sideHustleProfile
  if(!isSideHustleProfile(profile)||profile.family!=='commerce_affiliate'){
    throw new Error('AFFILIATE_PORTFOLIO_REQUIRES_COMMERCE_AFFILIATE')
  }

  const records=await repository.listSideHustleCommerceRecords({
    opportunityId,
    family:'commerce_affiliate',
    kind:'affiliate_event',
  })
  const events=records.map(row=>row.payload as SideHustleAffiliateEvent)
  return summarizeSideHustleAffiliatePortfolio(events)
}

function requireText(value:string,field:string):string{
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
