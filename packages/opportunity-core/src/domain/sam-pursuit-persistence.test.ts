import assert from 'node:assert/strict'
import { buildSamGovernedPursuitPlan } from './sam-pursuit-plan.js'
import { createSamPursuitSnapshot, recoverSamPursuitSnapshot } from './sam-pursuit-persistence.js'
const requirements={opportunityId:'o',generatedAt:'x',unresolved:[],requirements:[]}
const pursuit=buildSamGovernedPursuitPlan({requirements})
const envelope=createSamPursuitSnapshot({opportunityId:'o',requirements,fulfillment:undefined,commercial:undefined,reconciliation:undefined,freshness:[],engagement:undefined,ledgers:[],negotiations:[],contractReadiness:[],contractDrafts:[],pursuit},0,'2026-09-20T00:00:00Z')
assert.equal(envelope.snapshot.revision,1);assert.equal(recoverSamPursuitSnapshot(envelope).opportunityId,'o')
assert.throws(()=>recoverSamPursuitSnapshot({...envelope,checksum:'bad'}),/checksum mismatch/)
assert.throws(()=>createSamPursuitSnapshot({...envelope.snapshot,opportunityId:'other'} as never),/mismatch/)
console.log('sam-pursuit-persistence tests passed')
