import assert from 'node:assert/strict'
import {
  parseCmsGovernmentHospitals,
  parseIpedsPublicInstitutions,
  probeGovernmentUnitsSchema,
} from './public-buyer-registry.js'

const hospitals=parseCmsGovernmentHospitals({
  results:[
    {
      facility_id:'010001',
      facility_name:'SOUTHEAST HEALTH MEDICAL CENTER',
      citytown:'DOTHAN',
      state:'AL',
      countyparish:'HOUSTON',
      hospital_ownership:'Government - Hospital District or Authority',
    },
    {
      facility_id:'999999',
      facility_name:'PRIVATE HOSPITAL',
      citytown:'TEST',
      state:'AL',
      hospital_ownership:'Voluntary non-profit - Private',
    },
  ],
})
assert.equal(hospitals.length,1)
assert.equal(hospitals[0]?.facilityId,'010001')
assert.equal(hospitals[0]?.ownership,'Government - Hospital District or Authority')
assert.equal(hospitals[0]?.state,'AL')

const ipeds=[
  'UNITID,INSTNM,CITY,STABBR,CONTROL,WEBADDR,LATITUDE,LONGITUD',
  '100001,"Example Public University",Example City,CA,1,www.example.edu,34.1000,-118.2000',
  '100002,"Example Private College",Elsewhere,CA,2,www.private.edu,34.2,-118.3',
].join('\n')
const institutions=parseIpedsPublicInstitutions(ipeds,'https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip')
assert.equal(institutions.length,1)
assert.equal(institutions[0]?.unitId,'100001')
assert.equal(institutions[0]?.control,'public')
assert.deepEqual(institutions[0]?.officialDomainHints,['example.edu'])
assert.equal(institutions[0]?.latitude,34.1)

const quoted=[
  'UNITID,INSTNM,CITY,STABBR,CONTROL,WEBADDR',
  '100003,"University, Main Campus","Los Angeles",CA,1,https://university.example.edu',
].join('\n')
assert.equal(parseIpedsPublicInstitutions(quoted,'official').at(0)?.name,'University, Main Campus')

const gus=probeGovernmentUnitsSchema([
  'GOVID,NAME,GOVTYPE,STATE,COUNTY,FUNCCODE',
  '060001001,Example Water District,4,CA,037,91',
].join('\n'))
assert.equal(gus.status,'READY_FOR_FIXTURE_REVIEW')
assert.equal(gus.recognized.governmentId,'GOVID')
assert.equal(gus.recognized.governmentType,'GOVTYPE')

const unknown=probeGovernmentUnitsSchema('A,B,C\n1,2,3')
assert.equal(unknown.status,'SCHEMA_UNRESOLVED')
assert.ok(unknown.blockers.length>=4)

console.log('public buyer registry tests passed')
