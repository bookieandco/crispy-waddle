import { describe,expect,it } from 'vitest'
import {
  assessBusinessGrowthLiveCommissioning,type GrowthLiveInput,type GrowthLiveProof,
} from './business-growth-live-certification.js'
import type { GrowthContributionReceipt } from './business-growth-experiments.js'

const now='2026-10-15T18:00:00Z'
const website='https://www.pupsonstuff.com'
const ventureId='venture:pupson'
const businessId='business:pupson'
const shared={ventureId,businessId,website,serverVerified:true,observedAt:now}
const receipt={
  receiptId:'receipt:commerce:1',businessId,missionId:'growth:mission1',
  experimentId:'growth:experiment1',sourceAssetId:'asset:1',
  campaignId:'campaign:1',orderId:'order:1',provider:'stripe',
  providerSettlementRef:'settlement:1',currency:'USD' as const,
  settledAt:now,grossRevenueCents:4200,refundsCents:100,
  fulfillmentCents:1200,platformFeesCents:200,
  attributionCostCents:300,evidenceRefs:['receipt:commerce:1'],
  source:'CANONICAL_COMMERCE_RECONCILIATION' as const,
} satisfies GrowthContributionReceipt
const proofs: GrowthLiveProof[]=[
  {...shared,kind:'OWNED_SITE',source:'OWNER_REGISTRY',evidenceRef:'owner:site:1'},
  {...shared,kind:'SEARCH_CONSOLE',source:'GOOGLE_SEARCH_CONSOLE',evidenceRef:'gsc:provider:1'},
  {...shared,kind:'SITE_INSPECTION',source:'OWNED_SITE_AUDITOR',evidenceRef:'audit:page:1'},
  {...shared,kind:'CONTENT_APPROVAL',source:'CANONICAL_APPROVAL_LEDGER',evidenceRef:'approval:receipt:1',
    approvalReceiptId:'approved:asset1',assetId:'asset:1',campaignId:'campaign:1'},
  {...shared,kind:'PUBLISH_DELIVERY',source:'PUBLISH_PROVIDER',evidenceRef:'provider:delivery:1',
    approvalReceiptId:'approved:asset1',assetId:'asset:1',campaignId:'campaign:1',
    providerDeliveryId:'delivery:1'},
  {...shared,kind:'COMMERCE_SETTLEMENT',source:'COMMERCE_RECONCILER',evidenceRef:'receipt:commerce:1',
    assetId:'asset:1',campaignId:'campaign:1',orderId:'order:1'},
]
const baseline: GrowthLiveInput={
  ventureId,businessId,missionId:'growth:mission1',experimentId:'growth:experiment1',
  ownedWebsite:website,now,proofs,
  settlement:receipt,previouslyScoredOrderIds:[],
}
describe('BIZ-GROWTH-LIVE.01–.06 fail-closed receipts',()=>{
  it('proves exact-source mock evidence without issuing any authority',()=>{
    const r=assessBusinessGrowthLiveCommissioning(baseline)
    expect(r.result).toBe('PROVEN_END_TO_END')
    expect(r.gates.every(g=>g.status==='PASS')).toBe(true)
    expect(r.verifiedConversionCents).toBe(2400)
    expect(r.possibleEarnedXp).toBe(44)
    expect(r.externalExecutionAuthorized).toBe(false)
    expect(r.productionPublicationAuthorized).toBe(false)
    expect(r.unattendedPublishingAuthorized).toBe(false)
    expect(r.spendingAuthorized).toBe(false)
  })
  it('requires every one of six receipts',()=>{
    for(const proof of proofs){
      const r=assessBusinessGrowthLiveCommissioning({
        ...baseline,proofs:proofs.filter(row=>row!==proof),
      })
      expect(r.result).toBe('BLOCKED')
      expect(r.possibleEarnedXp).toBe(0)
      expect(r.gates.find(g=>g.code===proof.kind)?.status).toBe('BLOCKED')
    }
  })
  it('rejects untrusted/future/stale GSC evidence',()=>{
    const r=assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='SEARCH_CONSOLE'?{...p,serverVerified:false}:p),
    })
    expect(r.result).toBe('BLOCKED')
    expect(r.gates.find(g=>g.code==='SEARCH_CONSOLE')?.status).toBe('BLOCKED')
    expect(assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='SEARCH_CONSOLE'?{...p,observedAt:'2026-09-15T00:00:00Z'}:p),
    }).result).toBe('BLOCKED')
    expect(assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='SEARCH_CONSOLE'?{...p,observedAt:'2026-10-16T00:00:00Z'}:p),
    }).result).toBe('BLOCKED')
  })
  it('rejects cross-business and duplicate receipts instead of ignoring them',()=>{
    expect(()=>assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='OWNED_SITE'?{...p,businessId:'business:other'}:p),
    })).toThrow('BIZ_GROWTH_LIVE_CROSS_BUSINESS_PROOF')
    expect(()=>assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:[...proofs,proofs[0]!],
    })).toThrow('BIZ_GROWTH_LIVE_DUPLICATE_KIND')
  })
  it('does not confuse approval with provider publication',()=>{
    const r=assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='PUBLISH_DELIVERY'
        ?{...p,approvalReceiptId:'approved:wrong'}:p),
    })
    expect(r.result).toBe('BLOCKED')
    expect(r.gates.find(g=>g.code==='PUBLISH_DELIVERY')?.status).toBe('BLOCKED')
    expect(r.verifiedConversionCents).toBeNull()
  })
  it('does not count revenue when order was already scored or settlement is missing',()=>{
    const previous=assessBusinessGrowthLiveCommissioning({...baseline,previouslyScoredOrderIds:['order:1']})
    expect(previous.gates.find(g=>g.code==='COMMERCE_SETTLEMENT')?.status).toBe('BLOCKED')
    expect(previous.possibleEarnedXp).toBe(0)
    const missing=assessBusinessGrowthLiveCommissioning({...baseline,settlement:undefined})
    expect(missing.result).toBe('BLOCKED')
    expect(missing.verifiedConversionCents).toBeNull()
  })
  it('blocks a mismatched asset/campaign/order even if receipt ids are present',()=>{
    const r=assessBusinessGrowthLiveCommissioning({...baseline,
      settlement:{...receipt,campaignId:'other'},
    })
    expect(r.result).toBe('BLOCKED')
    const wrongMission=assessBusinessGrowthLiveCommissioning({...baseline,
      missionId:'growth:other-mission',
    })
    expect(wrongMission.result).toBe('BLOCKED')
    const earlySettlement=assessBusinessGrowthLiveCommissioning({...baseline,
      settlement:{...receipt,settledAt:'2026-10-14T00:00:00Z'},
    })
    expect(earlySettlement.result).toBe('BLOCKED')
    const wrong=assessBusinessGrowthLiveCommissioning({...baseline,
      proofs:proofs.map(p=>p.kind==='COMMERCE_SETTLEMENT'?{...p,orderId:'order:other'}:p),
    })
    expect(wrong.result).toBe('BLOCKED')
  })
})
