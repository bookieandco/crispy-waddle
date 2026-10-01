import type { UsStateOrDcCode } from './public-opportunity-grid.js'

export const US_STATE_FIPS: Readonly<Record<UsStateOrDcCode, string>> = {
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',DC:'11',FL:'12',
  GA:'13',HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',
  MD:'24',MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',
  NJ:'34',NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',
  SC:'45',SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',
} as const

export const US_STATE_NAMES: Readonly<Record<UsStateOrDcCode, string>> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',
  GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',
  MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',
  SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
} as const

export const CENSUS_GAZETTEER_YEAR = 2026 as const
export const CENSUS_GAZETTEER_BASE =
  'https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer'

export type CensusCountyGazetteerRecord = {
  state: UsStateOrDcCode
  stateFips: string
  geoid: string
  geoidFq: string
  ansiCode: string
  name: string
  normalizedName: string
  latitude: number
  longitude: number
  sourceUrl: string
}

function cleanCountyName(name:string):string{
  return name
    .replace(/\s+(County|Parish|Borough|Census Area|Municipality|City and Borough|city)$/i,'')
    .trim()
}

function num(value:string,label:string):number{
  const parsed=Number(value)
  if(!Number.isFinite(parsed))throw new Error(`Invalid Census Gazetteer ${label}: ${value}`)
  return parsed
}

export function buildCensusCountyGazetteerUrl(state:UsStateOrDcCode):string{
  const fips=US_STATE_FIPS[state]
  if(!fips)throw new Error(`Unsupported state/DC code: ${state}`)
  return `${CENSUS_GAZETTEER_BASE}/2026_gaz_counties_${fips}.txt`
}

export function parseCensusCountyGazetteer(
  text:string,
  expectedState?:UsStateOrDcCode,
  sourceUrl?:string,
):CensusCountyGazetteerRecord[]{
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  if(lines.length<2)throw new Error('Census county Gazetteer response is empty.')
  const header=lines[0]!.split('|').map(value=>value.trim())
  const required=['USPS','GEOID','GEOIDFQ','ANSICODE','NAME','INTPTLAT','INTPTLONG']
  for(const field of required){
    if(!header.includes(field))throw new Error(`Census county Gazetteer is missing ${field}.`)
  }
  const index=(field:string)=>header.indexOf(field)
  const records:CensusCountyGazetteerRecord[]=[]
  for(const line of lines.slice(1)){
    const cells=line.split('|').map(value=>value.trim())
    const state=cells[index('USPS')] as UsStateOrDcCode
    if(!US_STATE_FIPS[state])throw new Error(`Unknown Gazetteer state code: ${state}`)
    if(expectedState&&state!==expectedState)throw new Error(`Gazetteer state mismatch: expected ${expectedState}, received ${state}`)
    const geoid=cells[index('GEOID')]??''
    const name=cells[index('NAME')]??''
    if(!/^\d{5}$/.test(geoid)||!name)throw new Error('Gazetteer county row lacks a valid GEOID/name.')
    records.push({
      state,
      stateFips:US_STATE_FIPS[state],
      geoid,
      geoidFq:cells[index('GEOIDFQ')]??'',
      ansiCode:cells[index('ANSICODE')]??'',
      name,
      normalizedName:cleanCountyName(name),
      latitude:num(cells[index('INTPTLAT')]??'','latitude'),
      longitude:num(cells[index('INTPTLONG')]??'','longitude'),
      sourceUrl:sourceUrl??buildCensusCountyGazetteerUrl(state),
    })
  }
  return records
}


export type CensusPlaceGazetteerRecord = {
  state: UsStateOrDcCode
  stateFips: string
  geoid: string
  geoidFq: string
  ansiCode: string
  name: string
  normalizedName: string
  lsad: string
  funcStat: string
  governmental: boolean
  latitude: number
  longitude: number
  sourceUrl: string
}

export type CensusSchoolDistrictKind = 'elementary'|'secondary'|'unified'|'administrative'

export type CensusSchoolDistrictGazetteerRecord = {
  state: UsStateOrDcCode
  geoid: string
  geoidFq: string
  name: string
  normalizedName: string
  kind: CensusSchoolDistrictKind
  lowGrade?: string
  highGrade?: string
  latitude: number
  longitude: number
  sourceUrl: string
}

export function buildCensusPlaceGazetteerUrl(state:UsStateOrDcCode):string{
  const fips=US_STATE_FIPS[state]
  if(!fips)throw new Error(`Unsupported state/DC code: ${state}`)
  return `${CENSUS_GAZETTEER_BASE}/2026_gaz_place_${fips}.txt`
}

export function buildCensusSchoolDistrictGazetteerZipUrl(kind:CensusSchoolDistrictKind):string{
  const code:Record<CensusSchoolDistrictKind,string>={
    elementary:'elsd',
    secondary:'scsd',
    unified:'unsd',
    administrative:'sdadm',
  }
  return `${CENSUS_GAZETTEER_BASE}/2026_Gaz_${code[kind]}_national.zip`
}

function cleanPlaceName(name:string):string{
  return name.replace(/\s+(city|town|village|borough|municipality|city and borough|consolidated government)$/i,'').trim()
}

export function parseCensusPlaceGazetteer(
  text:string,
  expectedState?:UsStateOrDcCode,
  sourceUrl?:string,
):CensusPlaceGazetteerRecord[]{
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  if(lines.length<2)throw new Error('Census place Gazetteer response is empty.')
  const header=lines[0]!.split('|').map(value=>value.trim())
  const required=['USPS','GEOID','GEOIDFQ','ANSICODE','NAME','LSAD','FUNCSTAT','INTPTLAT','INTPTLONG']
  for(const field of required){
    if(!header.includes(field))throw new Error(`Census place Gazetteer is missing ${field}.`)
  }
  const index=(field:string)=>header.indexOf(field)
  const records:CensusPlaceGazetteerRecord[]=[]
  for(const line of lines.slice(1)){
    const cells=line.split('|').map(value=>value.trim())
    const state=cells[index('USPS')] as UsStateOrDcCode
    if(!US_STATE_FIPS[state])throw new Error(`Unknown Gazetteer state code: ${state}`)
    if(expectedState&&state!==expectedState)throw new Error(`Gazetteer state mismatch: expected ${expectedState}, received ${state}`)
    const geoid=cells[index('GEOID')]??''
    const name=cells[index('NAME')]??''
    const funcStat=cells[index('FUNCSTAT')]??''
    if(!/^\d{7}$/.test(geoid)||!name)throw new Error('Gazetteer place row lacks a valid GEOID/name.')
    records.push({
      state,
      stateFips:US_STATE_FIPS[state],
      geoid,
      geoidFq:cells[index('GEOIDFQ')]??'',
      ansiCode:cells[index('ANSICODE')]??'',
      name,
      normalizedName:cleanPlaceName(name),
      lsad:cells[index('LSAD')]??'',
      funcStat,
      governmental:funcStat==='A',
      latitude:num(cells[index('INTPTLAT')]??'','latitude'),
      longitude:num(cells[index('INTPTLONG')]??'','longitude'),
      sourceUrl:sourceUrl??buildCensusPlaceGazetteerUrl(state),
    })
  }
  return records
}

export function parseCensusSchoolDistrictGazetteer(
  text:string,
  kind:CensusSchoolDistrictKind,
  sourceUrl?:string,
):CensusSchoolDistrictGazetteerRecord[]{
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean)
  if(lines.length<2)throw new Error('Census school-district Gazetteer response is empty.')
  const header=lines[0]!.split('|').map(value=>value.trim())
  const required=['USPS','GEOID','GEOIDFQ','NAME','INTPTLAT','INTPTLONG']
  for(const field of required){
    if(!header.includes(field))throw new Error(`Census school-district Gazetteer is missing ${field}.`)
  }
  const index=(field:string)=>header.indexOf(field)
  const records:CensusSchoolDistrictGazetteerRecord[]=[]
  for(const line of lines.slice(1)){
    const cells=line.split('|').map(value=>value.trim())
    const state=cells[index('USPS')] as UsStateOrDcCode
    if(!US_STATE_FIPS[state])continue
    const geoid=cells[index('GEOID')]??''
    const name=cells[index('NAME')]??''
    if(!/^\d+$/.test(geoid)||!name)continue
    records.push({
      state,
      geoid,
      geoidFq:cells[index('GEOIDFQ')]??'',
      name,
      normalizedName:name.replace(/\s+(School District|Schools|District)$/i,'').trim(),
      kind,
      lowGrade:index('LOGRADE')>=0?(cells[index('LOGRADE')]||undefined):undefined,
      highGrade:index('HIGRADE')>=0?(cells[index('HIGRADE')]||undefined):undefined,
      latitude:num(cells[index('INTPTLAT')]??'','latitude'),
      longitude:num(cells[index('INTPTLONG')]??'','longitude'),
      sourceUrl:sourceUrl??buildCensusSchoolDistrictGazetteerZipUrl(kind),
    })
  }
  return records
}

export type NationalCountyCatalogAssessment = {
  countyEquivalentCount:number
  representedStatesAndDc:UsStateOrDcCode[]
  missingStatesAndDc:UsStateOrDcCode[]
  duplicateGeoids:string[]
  status:'PASS'|'BLOCKED'
  blockers:string[]
}

export function assessNationalCountyCatalog(records:CensusCountyGazetteerRecord[]):NationalCountyCatalogAssessment{
  const counts=new Map<string,number>()
  for(const record of records)counts.set(record.geoid,(counts.get(record.geoid)??0)+1)
  const duplicateGeoids=[...counts.entries()].filter(([,count])=>count>1).map(([geoid])=>geoid)
  const representedStatesAndDc=[...new Set(records.map(record=>record.state))].sort() as UsStateOrDcCode[]
  const expected=Object.keys(US_STATE_FIPS) as UsStateOrDcCode[]
  const missingStatesAndDc=expected.filter(state=>!representedStatesAndDc.includes(state))
  const blockers:string[]=[]
  if(missingStatesAndDc.length)blockers.push(`Missing county/county-equivalent data for: ${missingStatesAndDc.join(', ')}`)
  if(duplicateGeoids.length)blockers.push(`Duplicate county GEOIDs: ${duplicateGeoids.join(', ')}`)
  if(records.length<3000)blockers.push(`National county/county-equivalent catalog is unexpectedly small: ${records.length}.`)
  return {
    countyEquivalentCount:records.length,
    representedStatesAndDc,
    missingStatesAndDc,
    duplicateGeoids,
    status:blockers.length?'BLOCKED':'PASS',
    blockers,
  }
}
