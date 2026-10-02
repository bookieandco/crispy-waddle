import assert from 'node:assert/strict'
import {
  assessPublicProviderCompliance,
  assessPublicWorkPackageCompliance,
  publicCompliancePackForState,
} from './public-compliance.js'

assert.equal(publicCompliancePackForState('CA').status,'verified')
assert.equal(publicCompliancePackForState('TX').status,'discovery_required')

const ca=assessPublicWorkPackageCompliance({
  state:'CA',
  label:'Electrical upgrade and installation',
  category:'construction',
  keywords:['public works','electrical'],
  estimatedValue:{max:150000,currency:'USD'},
})
assert.equal(ca.status,'review_required')
assert.ok(ca.requirements.some(row=>row.id==='CA_CSLB_LICENSE_IF_APPLICABLE'))
assert.ok(ca.requirements.some(row=>row.id==='CA_DIR_PWCR_IF_APPLICABLE'))
assert.ok(ca.missingEvidenceIds.includes('CA_PREVAILING_WAGE_REVIEW'))
assert.equal(ca.bidSubmissionAuthorized,false)
assert.equal(ca.legalConclusionAuthorized,false)

const caReady=assessPublicWorkPackageCompliance({
  state:'CA',
  label:'Electrical upgrade and installation',
  category:'construction',
  estimatedValue:{max:150000,currency:'USD'},
  evidenceIds:[
    'CA_CSLB_LICENSE_IF_APPLICABLE',
    'CA_DIR_PWCR_IF_APPLICABLE',
    'CA_PREVAILING_WAGE_REVIEW',
  ],
})
assert.equal(caReady.status,'evidence_complete')

const tx=assessPublicWorkPackageCompliance({
  state:'TX',
  label:'Roof replacement',
  category:'construction',
})
assert.equal(tx.status,'review_required')
assert.ok(tx.missingEvidenceIds.includes('TX_STATE_COMPLIANCE_PACK_REQUIRED'))

const provider=assessPublicProviderCompliance({
  packageAssessment:ca,
  providerEvidenceIds:['CA_CSLB_LICENSE_IF_APPLICABLE'],
})
assert.equal(provider.status,'review_required')
assert.ok(provider.missingEvidenceIds.includes('CA_DIR_PWCR_IF_APPLICABLE'))
assert.equal(provider.eligibilityConclusionAuthorized,false)

console.log('public compliance tests passed')
