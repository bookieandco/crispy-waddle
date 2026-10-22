import {test,expect} from 'vitest'
import {PUBLIC_PROCUREMENT_CANARY_NOTICES,readPublicProcurementCanary} from './procurement-public-canary-docket'

test('Oxnard public NIB evidence is usable without implying complete bid package',()=>{
 expect(PUBLIC_PROCUREMENT_CANARY_NOTICES).toHaveLength(2)
 const well=readPublicProcurementCanary('OXNARD-PW-25-96','2026-10-22T19:00:00Z')!
 expect(well.deadlineState).toBe('future_listed_recheck_required')
 expect(well.requiredPrimeLicenseClass).toBe('A')
 expect(well.bidSecurityFraction).toBe(0.10)
 expect(well.performanceBondFraction).toBe(1)
 expect(well.paymentBondFraction).toBe(1)
 expect(well.retainageFraction).toBe(0.05)
 expect(well.addenda[0]?.fullAttachmentsVerified).toBe(false)
 expect(well.addenda[0]?.acknowledged).toBe(false)
 expect(well.bidSubmissionAuthorized).toBe(false)
 expect(well.fullBidDocumentSetCertified).toBe(false)
 expect(well.complianceEvidenceMissing).toContain('10% bid security must be delivered physically by deadline at City Clerk office')
 expect(well.priceVerified).toBe(false)
})
test('transit center has Class B bid-eligibility gate and due date in local clock',()=>{
 const transit=readPublicProcurementCanary('OXNARD-PW-24-109','2026-10-28T21:01:00Z')!
 expect(transit.requiredPrimeLicenseClass).toBe('B')
 expect(transit.deadlineState).toBe('past_or_due')
 expect(transit.complianceEvidenceMissing.some(x=>x.includes('State-grant'))).toBe(true)
 expect(transit.fullPlansVerified).toBe(false)
})
test('unknown canary identifiers never create fabricated official documents',()=>{
 expect(readPublicProcurementCanary('RUSD-2026-27-11','2026-10-22T19:00:00Z')).toBe(null)
 expect(readPublicProcurementCanary('OXNARD-PW-25-96-FAKE','2026-10-22T19:00:00Z')).toBe(null)
})
