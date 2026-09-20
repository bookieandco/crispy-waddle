import assert from 'node:assert/strict'
import { buildSamGovernedPursuitPlan } from './sam-pursuit-plan.js'
const r=buildSamGovernedPursuitPlan({requirements:{opportunityId:'o',generatedAt:'x',unresolved:[],requirements:[]}})
assert.equal(r.status,'in_progress');assert.equal(r.nextStage,'provider_fulfillment');assert.equal(r.executionAuthorized,false)
const blocked=buildSamGovernedPursuitPlan({requirements:{opportunityId:'o',generatedAt:'x',unresolved:['missing deadline'],requirements:[]}})
assert.equal(blocked.status,'blocked');assert.ok(blocked.blockers.includes('missing deadline'))
console.log('sam-pursuit-plan tests passed')
