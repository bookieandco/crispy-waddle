import { describe,expect,it } from 'vitest'
import { assessSeoCmsWriteGate,preparePersonalSeoRepair } from './business-growth-repair-plan.js'

const now='2026-10-18T17:00:00Z'
const observed={
  url:'https://pupsonstuff.example/products/portrait',responseStatus:200,
  title:'Old portrait title',description:'Old description',
  evidenceRef:'crawl:verified-observation',inspectedAt:'2026-10-18T16:55:00Z',
}
const prepare=(overrides:Record<string,unknown>={})=>preparePersonalSeoRepair({
  registeredWebsite:'https://pupsonstuff.example/', observedPage:observed,
  field:'title',suggestedText:'Custom Pet Portraits | PupsonStuff',now,
  ...overrides,
})
describe('JH-PERSONAL-SEO.07 immutable fix previews',()=>{
  it('returns a deterministic no-write proposal for a fresh owned observation',()=>{
    const result=prepare()
    expect(result.state).toBe('PENDING_CANONICAL_ACTION_APPROVAL')
    expect(result.automaticWriteAuthorized).toBe(false)
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.proposalSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(result.before).toBe('Old portrait title')
    expect(result.after).toBe('Custom Pet Portraits | PupsonStuff')
    expect(prepare().proposalSha256).toBe(result.proposalSha256)
  })
  it('rejects cross-site, missing source, old data and unsafe text',()=>{
    expect(()=>prepare({observedPage:{...observed,url:'https://outside.example/'}}))
      .toThrow('SEO_REPAIR_CROSS_SITE')
    expect(()=>prepare({observedPage:{...observed,evidenceRef:''}}))
      .toThrow('SEO_REPAIR_EVIDENCE_REQUIRED')
    expect(()=>prepare({observedPage:{...observed,inspectedAt:'2026-10-15T12:00:00Z'}}))
      .toThrow('SEO_REPAIR_STALE_PAGE')
    expect(()=>prepare({suggestedText:'<script>bad</script>'})).toThrow('SEO_REPAIR_TEXT_INVALID')
    expect(()=>prepare({observedPage:{...observed,responseStatus:404}}))
      .toThrow('SEO_REPAIR_PAGE_NOT_ELIGIBLE')
  })
  it('does not allow browser-only approval or changed-page writes',()=>{
    const proposal=prepare()
    expect(assessSeoCmsWriteGate({proposal,currentFieldValue:proposal.before})
      .readyForAuthorizedAdapter).toBe(false)
    expect(assessSeoCmsWriteGate({proposal,currentFieldValue:proposal.before,
      trustedCanonicalApproval:{
        proposalSha256:proposal.proposalSha256,approvedAt:now,trustedServerVerified:false,
      }}).reason).toBe('CANONICAL_APPROVAL_REQUIRED')
    expect(assessSeoCmsWriteGate({proposal,currentFieldValue:'Someone edited the title',
      trustedCanonicalApproval:{proposalSha256:proposal.proposalSha256,approvedAt:now,
        trustedServerVerified:true}}).reason).toBe('PAGE_CHANGED_REVIEW_AGAIN')
    const match=assessSeoCmsWriteGate({proposal,currentFieldValue:proposal.before,
      trustedCanonicalApproval:{proposalSha256:proposal.proposalSha256,
        approvedAt:now,trustedServerVerified:true}})
    expect(match.readyForAuthorizedAdapter).toBe(true)
    expect(match.reason).toContain('ADAPTER_MUST_INDEPENDENTLY_AUTHORIZE')
  })
})
