import assert from 'node:assert/strict'
import { assessBrokerProvider } from './sam-provider-broker.js'
import { expandProviderTaxonomy, providerTaxonomySource } from './provider-taxonomy.js'

const taxonomy=expandProviderTaxonomy({
  id:'food',
  label:'refrigerated food delivery',
  naicsCodes:['424410'],
  pscCodes:['8915'],
})
assert.equal(taxonomy.sicCodes.includes('5141'),true)
assert.equal(taxonomy.pscCodes.includes('8915'),true)
assert.equal(taxonomy.keywords.some(value=>value.toLowerCase().includes('food supplier')),true)
assert.equal(taxonomy.keywords.some(value=>value.toLowerCase().includes('general line grocery')),true)
assert.equal(providerTaxonomySource().license,'Apache-2.0')

const intent={requirementId:'r1',keywords:['food delivery'],naicsCodes:['424410'],pscCodes:[],allowForeign:true as const}
const sameSource=assessBrokerProvider(intent,{
  id:'p1',legalName:'Food Co',country:'USA',naicsCodes:['424410'],keywords:[],awardCount:2,
  evidence:[
    {id:'u1',source:'usaspending'},
    {id:'u2',source:'usaspending'},
  ],
})
assert.equal(sameSource.status,'review_required')
assert.equal(sameSource.reasons.includes('multi-source provider evidence'),false)
assert.equal(sameSource.reasons.some(reason=>reason.includes('foreign provider')),false)

const corroborated=assessBrokerProvider(intent,{
  id:'p2',legalName:'Food Co',country:'US',naicsCodes:['424410'],keywords:[],awardCount:1,
  evidence:[
    {id:'u1',source:'usaspending'},
    {id:'s1',source:'sam_entity'},
  ],
})
assert.equal(corroborated.status,'candidate')
assert.equal(corroborated.reasons.includes('multi-source provider evidence'),true)

const foreign=assessBrokerProvider(intent,{
  id:'p3',legalName:'Proveedor MX',country:'MEX',naicsCodes:['424410'],keywords:[],awardCount:1,
  evidence:[
    {id:'u1',source:'usaspending'},
    {id:'s1',source:'sam_entity'},
  ],
})
assert.equal(foreign.reasons.some(reason=>reason.includes('foreign provider')),true)

console.log('sam provider discovery coverage tests passed')
