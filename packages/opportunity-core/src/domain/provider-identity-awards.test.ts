import assert from 'node:assert/strict'
import { resolveAwardToProvider, resolveProviderIdentity, summarizeProviderAwards, type ProviderIdentityCandidate } from './provider-identity-awards.js'
const c:ProviderIdentityCandidate[]=[{providerId:'p1',legalName:'Acme LLC',uei:'UEI1',cage:'C1',evidenceRefs:['e1']},{providerId:'p2',legalName:'Acme Services Inc',uei:'UEI2',cage:'C2',evidenceRefs:['e2']}]
const r=resolveProviderIdentity({legalName:'ACME LLC',uei:'UEI1'},c);assert.equal(r.status,'matched');assert.equal(r.matchedProviderId,'p1');assert.equal(r.confidence,'high')
const a=resolveAwardToProvider({id:'a1',recipientName:'Acme LLC',recipientUei:'UEI1',agency:'Agency',amount:100,currency:'USD',naicsCode:'541512',evidenceRefs:['aw1']},c);assert.equal(a.award?.providerId,'p1')
const s=summarizeProviderAwards('p1',[a.award!]);assert.equal(s.awardCount,1);assert.equal(s.totalKnownAwardValue,100)
const amb=resolveProviderIdentity({legalName:'Acme'},[{providerId:'x',legalName:'Acme LLC',evidenceRefs:[]},{providerId:'y',legalName:'Acme Inc',evidenceRefs:[]}]);assert.equal(amb.status,'ambiguous');assert.equal(amb.matchedProviderId,undefined)
console.log('provider-identity-awards tests passed')
