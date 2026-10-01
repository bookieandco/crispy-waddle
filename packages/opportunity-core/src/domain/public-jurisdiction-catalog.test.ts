import assert from 'node:assert/strict'
import {
  US_STATE_FIPS,
  assessNationalCountyCatalog,
  buildCensusCountyGazetteerUrl,
  parseCensusCountyGazetteer,
  parseCensusPlaceGazetteer,
  parseCensusSchoolDistrictGazetteer,
  buildCensusPlaceGazetteerUrl,
  buildCensusSchoolDistrictGazetteerZipUrl,
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


assert.equal(
  buildCensusPlaceGazetteerUrl('CA'),
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_gaz_place_06.txt',
)
assert.equal(
  buildCensusSchoolDistrictGazetteerZipUrl('unified'),
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_unsd_national.zip',
)

const caPlaceText=[
  'USPS|GEOID|GEOIDFQ|ANSICODE|NAME|LSAD|FUNCSTAT|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG',
  'CA|0604400|1600000US0604400|02409767|Azusa city|25|A|24900000|0|9.6|0|34.1336|-117.9076',
  'CA|0600450|1600000US0600450|02582928|Agua Dulce CDP|57|S|59181051|60418|22.85|0.023|34.501488|-118.183897',
].join('\n')
const places=parseCensusPlaceGazetteer(caPlaceText,'CA')
assert.equal(places.length,2)
assert.equal(places[0]?.normalizedName,'Azusa')
assert.equal(places[0]?.governmental,true)
assert.equal(places[1]?.governmental,false)

const schoolText=[
  'USPS|GEOID|GEOIDFQ|NAME|LOGRADE|HIGRADE|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG',
  'CA|0600001|9700000US0600001|Example Unified School District|KG|12|1|0|1|0|34.0|-118.0',
].join('\n')
const districts=parseCensusSchoolDistrictGazetteer(schoolText,'unified')
assert.equal(districts.length,1)
assert.equal(districts[0]?.state,'CA')
assert.equal(districts[0]?.kind,'unified')
assert.equal(districts[0]?.lowGrade,'KG')
assert.equal(districts[0]?.highGrade,'12')

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
