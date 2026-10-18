import assert from 'node:assert/strict'
import {
  assessZeroRigLiveCertification,zeroRigUncommissionedAssessment,
  type ZeroRigAcceptanceEvidence,type ZeroRigAcceptanceEvidenceKind,
} from './zero-rig-live-certification.js'

const sha='0123456789abcdef0123456789abcdef01234567'
const now='2026-10-17T21:00:00Z'
const empty=zeroRigUncommissionedAssessment(sha,now)
assert.equal(empty.status,'blocked')
assert.equal(empty.authorizedToPoll,false)
assert.equal(empty.authorizedToMoveMoney,false)
assert.equal(empty.liveRevenueVerified,false)
assert.ok(empty.missing.includes('provider_200'))
assert.ok(empty.missing.includes('ios_private_session'))
assert.ok(empty.blockers.includes('NO_LIVE_CANARY_RECEIPTS'))

const required:ZeroRigAcceptanceEvidenceKind[]=[
 'source_ci','owner_session','provider_200','provider_401','provider_429',
 'schema','listing_detail','owner_eligibility','ios_private_session',
 'tenant_isolation','money_receipts_separated','rate_limit',
]
const good:ZeroRigAcceptanceEvidence[]=required.map((kind,index)=>({
 kind,evidenceRef:'operator-proof:'+kind+':'+index,
 observedAt:'2026-10-17T20:00:00Z',ownerReviewed:true,
}))
const input={
 currentHeadSha:sha,sourceBranchHeadSha:sha,asOf:now,ownerBindingConfigured:true,
 agentKeyPresent:true,readFeatureFlagEnabled:true,
 independentReleaseApproval:true,observations:good,
}
const review=assessZeroRigLiveCertification(input)
assert.equal(review.status,'ready_for_separate_release_approval')
assert.equal(review.missing.length,0)
assert.equal(review.authorizedToClaim,false)
assert.equal(review.authorizedToSubmit,false)
assert.equal(review.authorizedToPoll,false)
assert.equal(review.liveRevenueVerified,false)

assert.equal(assessZeroRigLiveCertification({...input,sourceBranchHeadSha:'0'.repeat(40)}).status,'blocked')
assert.equal(assessZeroRigLiveCertification({...input,agentKeyPresent:false}).status,'blocked')
assert.equal(assessZeroRigLiveCertification({...input,readFeatureFlagEnabled:false}).status,'awaiting_external_acceptance')
assert.equal(assessZeroRigLiveCertification({...input,independentReleaseApproval:false}).status,'awaiting_external_acceptance')
const missingIOS=assessZeroRigLiveCertification({...input,observations:good.filter(x=>x.kind!=='ios_private_session')})
assert.equal(missingIOS.status,'awaiting_external_acceptance')
assert.ok(missingIOS.missing.includes('ios_private_session'))
const stale=assessZeroRigLiveCertification({...input,asOf:'2026-10-20T20:00:00Z'})
assert.equal(stale.evidenceFresh,false)
assert.ok(stale.missing.length>0)
const unreviewed=assessZeroRigLiveCertification({...input,observations:good.map(x=>({...x,ownerReviewed:false}))})
assert.equal(unreviewed.status,'awaiting_external_acceptance')
assert.equal(unreviewed.verifiedEvidenceKinds.length,0)
const malformed=assessZeroRigLiveCertification({...input,observations:good.map(x=>({...x,evidenceRef:'secret\nabc'}))})
assert.equal(malformed.evidenceFresh,false)
const duplicate=assessZeroRigLiveCertification({...input,observations:[...good,good[0]]})
assert.equal(duplicate.evidenceFresh,true) // duplicate cannot replace first, no fabricated extra evidence
console.log('JH-ZERO-RIG.CERT.01-.04 source and external-canary evidence tests passed; no execution authorized')
