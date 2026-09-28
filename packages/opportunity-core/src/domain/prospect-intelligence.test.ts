import assert from 'node:assert/strict'
import {
  buildProspectPersonalization,
  createIdealCustomerProfile,
  createProspectRecord,
  prepareProspectOutreachDraft,
} from './prospect-intelligence.js'

const now = '2026-09-28T18:30:00.000Z'

const icp = createIdealCustomerProfile({
  id: 'icp:local-service',
  label: 'Local service businesses with content bottlenecks',
  industries: ['home services'],
  geographies: ['US'],
  companySizeSignals: ['small-mid-market'],
  buyerRoles: ['owner', 'marketing lead'],
  painSignals: ['inconsistent content production'],
  triggerSignals: ['hiring marketing help'],
  disqualifiers: ['explicit do-not-contact'],
  evidenceRefs: ['market:interviews'],
  createdAt: now,
})

assert.equal(icp.authority, 'ANALYSIS_ONLY')

const prospect = createProspectRecord({
  id: 'prospect:1',
  icpId: icp.id,
  companyName: 'Example Services',
  contactName: 'Jamie',
  contactRole: 'Owner',
  businessContact: 'jamie@example.test',
  contactQuality: 'public_professional',
  fitSignals: ['matches ICP'],
  painSignals: ['inconsistent content production'],
  triggerSignals: ['recent hiring post'],
  notableContext: ['opened a second location'],
  evidence: [
    {
      id: 'evidence:company-site',
      sourceRef: 'https://example.test',
      observedAt: now,
      claim: 'Company operates in target market.',
      confidence: 0.9,
    },
    {
      id: 'evidence:hiring-post',
      sourceRef: 'https://example.test/jobs',
      observedAt: now,
      claim: 'Company is hiring marketing support.',
      confidence: 0.8,
    },
  ],
  suppressionState: 'clear',
  lastVerifiedAt: now,
})

assert.equal(prospect.outreachAuthorized, false)

const personalization = buildProspectPersonalization({
  prospect,
  whyThem: { text: 'Your company matches the target operating profile.', evidenceRefs: ['evidence:company-site'] },
  whyNow: { text: 'You recently posted a marketing role.', evidenceRefs: ['evidence:hiring-post'] },
  whyUs: { text: 'We have a bounded pilot relevant to this workflow.', evidenceRefs: ['offer:content-pilot'] },
  createdAt: now,
})

const draft = prepareProspectOutreachDraft({
  id: 'draft:1',
  prospect,
  personalization,
  channel: 'email',
  message: 'A concise, sourced outreach draft.',
  createdAt: now,
})

assert.equal(draft.draftOnly, true)
assert.equal(draft.sendAuthorized, false)
assert.ok(draft.evidenceRefs.includes('evidence:hiring-post'))

assert.throws(() => prepareProspectOutreachDraft({
  id: 'draft:2',
  prospect: { ...prospect, suppressionState: 'do_not_contact' },
  personalization,
  channel: 'email',
  message: 'Should not be admitted.',
  createdAt: now,
}), /SUPPRESSED/)

assert.throws(() => prepareProspectOutreachDraft({
  id: 'draft:3',
  prospect: { ...prospect, contactQuality: 'personal_or_unverified' },
  personalization,
  channel: 'email',
  message: 'Should not be admitted.',
  createdAt: now,
}), /UNVERIFIED_CONTACT/)

const inferred = { ...prospect, contactQuality: 'inferred_professional' as const }
assert.throws(() => prepareProspectOutreachDraft({
  id: 'draft:4',
  prospect: inferred,
  personalization,
  channel: 'email',
  message: 'Needs explicit admission.',
  createdAt: now,
}), /INFERRED_CONTACT_REQUIRES_EXPLICIT_ADMISSION/)

console.log('prospect-intelligence tests passed')
