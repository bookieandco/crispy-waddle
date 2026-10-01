import assert from 'node:assert/strict'
import {
  classifyDotGovDomainType,
  matchDotGovDomainToJurisdiction,
  normalizeGovernmentOrganization,
  parseDotGovRegistryCsv,
} from './dotgov-registry.js'

const csv=[
  'Domain name,Domain type,Organization name,Suborganization name,City,State,Security contact email',
  'alamedaca.gov,City,City of Alameda,,Alameda,CA,(blank)',
  'brazoriacounty.gov,County,Brazoria County,,Angleton,TX,(blank)',
  'pomonausd.gov,School district,Pomona Unified School District,,Pomona,CA,(blank)',
  'eastvalleywater.gov,Special district,East Valley Water District,,Highland,CA,(blank)',
  'idahovotes.gov,State or territory - Election,"State of Idaho, Office of Information Technology Services",,Boise,ID,(blank)',
].join('\n')

const rows=parseDotGovRegistryCsv(csv)
assert.equal(rows.length,5)
assert.equal(rows[0]?.domainType,'city')
assert.equal(rows[1]?.domainType,'county')
assert.equal(rows[2]?.domainType,'school_district')
assert.equal(rows[3]?.domainType,'special_district')
assert.equal(rows[4]?.domainType,'state')

assert.equal(classifyDotGovDomainType('State or territory - General'),'state')
assert.equal(normalizeGovernmentOrganization('City of Alameda'),'alameda')
assert.equal(normalizeGovernmentOrganization('Pomona Unified School District'),'pomona')

const cityMatch=matchDotGovDomainToJurisdiction(rows[0]!,[
  {id:'city:0600562',level:'city',state:'CA',name:'Alameda city',normalizedName:'Alameda'},
])
assert.equal(cityMatch?.jurisdictionId,'city:0600562')
assert.ok((cityMatch?.score??0)>=0.94)

const countyMatch=matchDotGovDomainToJurisdiction(rows[1]!,[
  {id:'county:48039',level:'county',state:'TX',name:'Brazoria County',normalizedName:'Brazoria'},
])
assert.equal(countyMatch?.jurisdictionId,'county:48039')

const schoolMatch=matchDotGovDomainToJurisdiction(rows[2]!,[
  {id:'school_district:unified:0629940',level:'school_district',state:'CA',name:'Pomona Unified School District',normalizedName:'Pomona Unified'},
])
assert.equal(schoolMatch?.jurisdictionId,'school_district:unified:0629940')

const wrongState=matchDotGovDomainToJurisdiction(rows[0]!,[
  {id:'city:other',level:'city',state:'TX',name:'Alameda',normalizedName:'Alameda'},
])
assert.equal(wrongState,undefined)

console.log('dotgov registry tests passed')
