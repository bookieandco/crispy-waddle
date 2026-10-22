import assert from 'node:assert/strict'
import { assessAutonomyCapability, prepareInternalServicePilot } from './autonomy-pilot.js'

const base = { executor:'tested' as const, providerPermission:'allowed' as const, evidenceRefs:['https://first.example/report'], testReceipt:'test:pass' }
const internal = assessAutonomyCapability({ ...base, capability:'research' })
assert.equal(internal.classification,'internal_draft_ready')
assert.equal(internal.canPerformExternalAction,false)
assert.equal(assessAutonomyCapability({...base,capability:'job_application'}).classification,'manual_review')
assert.equal(assessAutonomyCapability({...base,capability:'external_delivery',standingScopeReceipt:'owner:scope'}).canPerformExternalAction,false)
assert.equal(assessAutonomyCapability({...base,capability:'research',providerPermission:'forbidden'}).classification,'blocked')
assert.equal(assessAutonomyCapability({...base,capability:'research',executor:'unverified'}).canPrepareInternalDraft,false)
assert.equal(assessAutonomyCapability({...base,capability:'research',evidenceRefs:[]}).canPrepareInternalDraft,false)

const createdAt='2026-10-22T05:00:00.000Z'
const research = prepareInternalServicePilot({
  kind:'research_report',subject:'Business research',createdAt,
  evidence:[
    {sourceUrl:'https://example.com/a',observedAt:'2026-10-21',finding:'A traceable assertion'},
    {sourceUrl:'https://example.org/b',observedAt:'2026-10-21',finding:'Independent second assertion'},
  ],
})
assert.equal(research.state,'ready_for_owner_review')
assert.equal(research.family,'research_services')
assert.equal(research.externalActionAuthorized,false)
assert.equal(research.paidOutcomeVerified,false)
assert.match(research.document,/INTERNAL DRAFT/)

const oneSite = prepareInternalServicePilot({
  kind:'research_report',subject:'Needs evidence',createdAt,
  evidence:[
    {sourceUrl:'https://example.com/a',observedAt:'2026-10-21',finding:'One'},
    {sourceUrl:'https://example.com/b',observedAt:'2026-10-21',finding:'Two'},
  ],
})
assert.equal(oneSite.state,'needs_evidence')
const leads = prepareInternalServicePilot({
  kind:'qualified_leads',subject:'Candidate segment',createdAt,
  evidence:[
    {sourceUrl:'https://site-a.example/team',observedAt:'2026-10-21',finding:'Lead 1',subject:'Company A'},
    {sourceUrl:'https://site-b.example/team',observedAt:'2026-10-21',finding:'Lead 2',subject:'Company B'},
  ],
})
assert.equal(leads.state,'ready_for_owner_review')
assert.equal(leads.family,'lead_generation_growth')
const seo = prepareInternalServicePilot({
  kind:'seo_audit',subject:'https://brand.example',createdAt,
  evidence:[
    {sourceUrl:'https://brand.example/page',observedAt:'2026-10-21',finding:'Page observation'},
    {sourceUrl:'https://other.example/ref',observedAt:'2026-10-21',finding:'Secondary evidence'},
  ],
})
assert.equal(seo.state,'ready_for_owner_review')
assert.equal(seo.family,'ai_discovery_seo')
assert.throws(()=>prepareInternalServicePilot({kind:'research_report',subject:'Unsafe',createdAt,evidence:[{sourceUrl:'http://localhost/admin',observedAt:'2026-10-21',finding:'bad'}]}),/public HTTPS/)
assert.throws(()=>prepareInternalServicePilot({kind:'research_report',subject:'Future',createdAt,evidence:[{sourceUrl:'https://a.example/x',observedAt:'2026-10-23',finding:'bad'}]}),/future/)
assert.throws(()=>prepareInternalServicePilot({kind:'research_report',subject:'Repeat',createdAt,evidence:[{sourceUrl:'https://a.example/x',observedAt:'2026-10-21',finding:'same'},{sourceUrl:'https://a.example/x',observedAt:'2026-10-21',finding:'same'}]}),/Duplicate/)
console.log('OCE autonomy pilot domain tests passed')
