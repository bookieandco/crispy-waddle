import { describe,expect,it } from 'vitest'
import { preparePersonalSeoRepair } from '@jhadina/growth-core'
import { executeApprovedPersonalSeoFix, type VersionedCmsAdapter } from './personal-seo-cms-executor'

const proposal=preparePersonalSeoRepair({
  registeredWebsite:'https://pupsonstuff.example/',
  observedPage:{url:'https://pupsonstuff.example/',responseStatus:200,
    title:'Old title',evidenceRef:'crawl:real',inspectedAt:'2026-10-18T16:00:00Z'},
  field:'title',suggestedText:'New title',now:'2026-10-18T16:20:00Z',
})
function mock(mode:'normal'|'bad-post-write'|'conflict'='normal'){
  let value='Old title',revision='r1',writes=0
  const adapter:VersionedCmsAdapter={
    providerAccountId:'cms-account:owned',
    async read(){return {value,revision}},
    async compareAndSet(input){
      if(mode==='conflict' || input.expectedRevision!==revision)throw new Error('revision conflict')
      writes++
      value=mode==='bad-post-write' && writes===1?'Unapproved provider result':input.value
      revision='r'+(writes+1)
      return {revision,providerReceiptId:'cms:receipt:'+writes}
    },
  }
  return {adapter,getWrites:()=>writes}
}
const approval=async(hash:string)=>({
  proposalSha256:hash,approvedAt:'2026-10-18T17:00:00Z',
  approvedByUserId:'user:owner',providerAccountId:'cms-account:owned',
  receiptId:'action:verified',trustedServerVerified:true as const,
})
describe('JH-PERSONAL-SEO.07 governed CMS adapter',()=>{
  it('requires owner-bound trusted canonical approval and refuses an unverified write',async()=>{
    const fake=mock()
    const result=await executeApprovedPersonalSeoFix({
      proposal,ownerUserId:'user:owner',adapter:fake.adapter,
      loadCanonicalApproval:async()=>null,
    })
    expect(result.status).toBe('FAILED_CLOSED')
    expect(fake.getWrites()).toBe(0)
  })
  it('uses a versioned conditional write and post-write confirmation',async()=>{
    const fake=mock()
    const result=await executeApprovedPersonalSeoFix({
      proposal,ownerUserId:'user:owner',adapter:fake.adapter,
      loadCanonicalApproval:approval,
    })
    expect(result.status).toBe('APPLIED_AND_VERIFIED')
    expect(result.providerReceiptIds).toEqual(['cms:receipt:1'])
    expect(fake.getWrites()).toBe(1)
    expect(result.seoRankingImprovementProven).toBe(false)
  })
  it('reverts unexpected provider content only if revision still matches',async()=>{
    const fake=mock('bad-post-write')
    const result=await executeApprovedPersonalSeoFix({
      proposal,ownerUserId:'user:owner',adapter:fake.adapter,
      loadCanonicalApproval:approval,
    })
    expect(result.status).toBe('ROLLBACK_VERIFIED')
    expect(fake.getWrites()).toBe(2)
  })
  it('never claims a write when the provider rejects revision',async()=>{
    const fake=mock('conflict')
    const result=await executeApprovedPersonalSeoFix({
      proposal,ownerUserId:'user:owner',adapter:fake.adapter,
      loadCanonicalApproval:approval,
    })
    expect(result.status).toBe('FAILED_CLOSED')
    expect(fake.getWrites()).toBe(0)
  })
})
