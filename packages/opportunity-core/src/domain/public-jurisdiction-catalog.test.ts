import assert from 'node:assert/strict'
import {
  US_STATE_FIPS,
  assessNationalCountyCatalog,
  buildCensusCountyGazetteerUrl,
  parseCensusCountyGazetteer,
} from './public-jurisdiction-catalog.js'

assert.equal(Object.keys(US_STATE_FIPS).length,51)
assert.equal(US_STATE_FIPS.CA,'06')
assert.equal(US_STATE_FIPS.DC,'11')
assert.equal(
  buildCensusCountyGazetteerUrl('CA'),
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_counties_06.txt',
)

const caText=[
  'USPS|GEOID|GEOIDFQ|ANSICODE|NAME|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG',
  'CA|06037|0500000US06037|00277283|Los Angeles County|10516107376|1784884136|4060.292|689.148|34.196398|-118.261862',
  'CA|06059|0500000US06059|00277294|Orange County|2054502926|405284100|793.248|156.481|33.675687|-117.777207',
].join('\n')
const rows=parseCensusCountyGazetteer(caText,'CA')
assert.equal(rows.length,2)
assert.equal(rows[0]?.geoid,'06037')
assert.equal(rows[0]?.normalizedName,'Los Angeles')
assert.equal(rows[1]?.normalizedName,'Orange')

assert.throws(()=>parseCensusCountyGazetteer(caText,'TX'),/state mismatch/i)

const syntheticNational=Object.entries(US_STATE_FIPS).flatMap(([state,fips],stateIndex)=>
  Array.from({length:60},(_,countyIndex)=>({
    state:state as keyof typeof US_STATE_FIPS,
    stateFips:fips,
    geoid:`${fips}${String(countyIndex*2+1).padStart(3,'0')}`,
    geoidFq:`0500000US${fips}${String(countyIndex*2+1).padStart(3,'0')}`,
    ansiCode:`ansi:${stateIndex}:${countyIndex}`,
    name:`Example ${countyIndex} County`,
    normalizedName:`Example ${countyIndex}`,
    latitude:0,
    longitude:0,
    sourceUrl:buildCensusCountyGazetteerUrl(state as keyof typeof US_STATE_FIPS),
  }))
)
const assessment=assessNationalCountyCatalog(syntheticNational)
assert.equal(assessment.status,'PASS')
assert.equal(assessment.representedStatesAndDc.length,51)
assert.equal(assessment.countyEquivalentCount,3060)

console.log('public jurisdiction catalog tests passed')
