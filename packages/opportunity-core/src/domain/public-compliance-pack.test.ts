import assert from 'node:assert/strict'
import {
  CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  assessPublicStateCompliance,
  buildNationalStateComplianceManifest,
  type PublicComplianceEvidence,
} from './public-compliance-pack.js'

const manifest=buildNationalStateComplianceManifest()
assert.equal(manifest.length,51)
assert.equal(manifest.find(pack=>pack.state==='CA')?.status,'verified_reference')
assert.equal(manifest.find(pack=>pack.state==='TX')?.status,'discovery_required')

const context={
  state:'CA' as const,
  publicWorks:'yes' as const,
  workType:'construction' as const,
  estimatedValue:100_000,
  tradeLicenseApplicable:'yes' as const,
  hasEmployees:'yes' as const,
  intendsToBid:true,
  willPerformWork:true,
}

const missing=assessPublicStateCompliance({
  pack:CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  context,
  evidence:[],
})
assert.equal(missing.status,'review_required')
assert.ok(missing.conditions.some(value=>value.includes('CA-CSLB-LICENSE')))
assert.equal(missing.externalActionAuthorized,false)
assert.equal(missing.isLegalAdvice,false)

const kinds=[
  'contractor_license',
  'public_works_registration',
  'workers_comp_or_exemption',
  'prevailing_wage_plan',
  'apprenticeship_plan',
  'certified_payroll_capability',
  'debarment_clearance',
  'wage_assessment_clearance',
] as const
const evidence:PublicComplianceEvidence[]=kinds.map((kind,index)=>({
  id:`e:${index}`,
  kind,
  status:'verified',
  evidenceRef:`verified:${kind}`,
}))
const passed=assessPublicStateCompliance({
  pack:CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  context,
  evidence,
})
assert.equal(passed.status,'pass')
assert.equal(passed.blockers.length,0)
assert.equal(passed.conditions.length,0)

const blocked=assessPublicStateCompliance({
  pack:CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  context,
  evidence:evidence.map(item=>item.kind==='contractor_license'?{...item,status:'expired' as const}:item),
})
assert.equal(blocked.status,'blocked')
assert.ok(blocked.blockers.some(value=>value.includes('CA-CSLB-LICENSE')))

const underThreshold=assessPublicStateCompliance({
  pack:CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  context:{...context,estimatedValue:29_999},
  evidence:evidence.filter(item=>item.kind!=='apprenticeship_plan'),
})
assert.equal(underThreshold.gateResults.find(result=>result.gateId==='CA-APPRENTICESHIP')?.status,'not_applicable')
assert.equal(underThreshold.status,'pass')

const unknownTexas=assessPublicStateCompliance({
  pack:manifest.find(pack=>pack.state==='TX')!,
  context:{...context,state:'TX'},
  evidence:[],
})
assert.equal(unknownTexas.status,'review_required')
assert.ok(unknownTexas.conditions[0]?.includes('No verified state-specific compliance pack'))

assert.throws(()=>assessPublicStateCompliance({
  pack:CALIFORNIA_PUBLIC_WORKS_COMPLIANCE_PACK,
  context:{...context,state:'NV'},
  evidence:[],
}),/state mismatch/i)

console.log('public compliance pack tests passed')
