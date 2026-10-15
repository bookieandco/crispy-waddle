import {
  buildBusinessGrowthMissionDeck,
  type BusinessGrowthSnapshot,
  type BusinessGrowthDeck,
} from '@jhadina/opportunity-core'
import { fetchReadOnlyGscSnapshot, type GscHttpClient } from '@jhadina/growth-core'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { VentureRuntimeRepository } from '@/lib/opportunities/venture-runtime-repository'

/**
 * Server-only authorized Search Console -> Venture planning adapter.
 * The caller must obtain the Google OAuth token from its own verified
 * consent-bound integration. Never wire a browser-supplied token into this.
 * Does not write any work item or grant execution.
 */
export async function researchOwnedVentureWithGsc(input: {
  ownerUserId: string
  ventureId: string
  // Must come from verified owner-site association, not a request body:
  registeredOwnedWebsite: string
  gscProperty: string
  serverGoogleReadOnlyToken: string
  startDate: string
  endDate: string
  now: string
  fetchClient?: GscHttpClient
}): Promise<{ deck: BusinessGrowthDeck; rowCount: number; providerCoverage: 'PARTIAL_TOP_ROWS'; authorizedToPublish: false }> {
  if (!input.ownerUserId.trim() || !input.ventureId.trim()) throw new Error('BIZ_GSC_OWNER_VENTURE_REQUIRED')
  const service = createServiceRoleClient()
  if (!service) throw new Error('BIZ_GSC_VENTURE_RUNTIME_NOT_CONFIGURED')
  const ownedVenture = await new VentureRuntimeRepository(service).getVenture(input.ownerUserId, input.ventureId)
  if (!ownedVenture || ['killed','archived','paused'].includes(ownedVenture.lifecycle)) {
    throw new Error('BIZ_GSC_OWNED_ACTIVE_VENTURE_REQUIRED')
  }
  const gsc = await fetchReadOnlyGscSnapshot({
    businessWebsite:input.registeredOwnedWebsite,
    property:input.gscProperty,
    startDate:input.startDate,endDate:input.endDate,
    retrievedAt:input.now, serverAccessToken:input.serverGoogleReadOnlyToken,
    fetchClient:input.fetchClient,
  })
  const propertyEvidence='gsc:property:'+encodeURIComponent(gsc.property)+':'+gsc.dateRange.endDate
  const observed = {
    ref:propertyEvidence,kind:'search_console' as const,
    observedAt:input.now,verified:true,
  }
  const snapshot: BusinessGrowthSnapshot={
    ventureId:ownedVenture.id,businessId:ownedVenture.id,
    siteUrl:input.registeredOwnedWebsite,observedAt:input.now,
    evidence:[observed,...gsc.rows.map(row=>({
      ref:row.id,kind:'search_console' as const,observedAt:row.retrievedAt,verified:true,
    }))],
    signals:gsc.rows.map(row=>({
      id:row.id.replace(/[^a-zA-Z0-9:_-]/g,'_'),
      query:row.query,existingPageUrl:row.page,
      intent:/(buy|shop|order|custom|personalized|price|gift|near me|best)/i.test(row.query)
        ? 'commercial' as const : 'informational' as const,
      impressions:row.impressions,clicks:row.clicks,evidenceRefs:[row.id,propertyEvidence],
    })),
  }
  return {
    deck:buildBusinessGrowthMissionDeck(snapshot),rowCount:gsc.rows.length,
    providerCoverage:'PARTIAL_TOP_ROWS',authorizedToPublish:false,
  }
}
