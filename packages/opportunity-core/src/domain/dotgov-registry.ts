import type { PublicJurisdictionLevel, UsStateOrDcCode } from './public-opportunity-grid.js'

export const DOTGOV_REGISTRY_CSV_URL='https://raw.githubusercontent.com/cisagov/dotgov-data/main/current-full.csv'

export type DotGovDomainType=
  |'state'
  |'county'
  |'city'
  |'school_district'
  |'special_district'
  |'other'

export type DotGovRegistryRecord={
  domain:string
  rawDomainType:string
  domainType:DotGovDomainType
  organization:string
  suborganization?:string
  city?:string
  state?:UsStateOrDcCode
}

export type DotGovJurisdictionMatchInput={
  id:string
  level:PublicJurisdictionLevel
  state:UsStateOrDcCode
  name:string
  normalizedName:string
}

export type DotGovJurisdictionMatch={
  jurisdictionId:string
  score:number
  reason:string
}

const stateCodes=new Set<UsStateOrDcCode>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
])

function parseCsvLine(line:string):string[]{
  const out:string[]=[]
  let current=''
  let quoted=false
  for(let index=0;index<line.length;index+=1){
    const char=line[index]!
    if(char==='"'){
      if(quoted&&line[index+1]==='"'){
        current+='"'
        index+=1
      }else{
        quoted=!quoted
      }
      continue
    }
    if(char===','&&!quoted){
      out.push(current.trim())
      current=''
      continue
    }
    current+=char
  }
  out.push(current.trim())
  return out
}

export function classifyDotGovDomainType(raw:string):DotGovDomainType{
  const value=raw.trim().toLowerCase()
  if(value.startsWith('state or territory'))return'state'
  if(value==='county')return'county'
  if(value==='city')return'city'
  if(value==='school district')return'school_district'
  if(value==='special district')return'special_district'
  return'other'
}

export function parseDotGovRegistryCsv(csv:string):DotGovRegistryRecord[]{
  const lines=csv.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim())
  if(lines.length<2)throw new Error('DOTGOV_REGISTRY_EMPTY')
  const header=parseCsvLine(lines[0]!)
  const index=(name:string)=>header.indexOf(name)
  for(const required of ['Domain name','Domain type','Organization name','Suborganization name','City','State']){
    if(index(required)<0)throw new Error(`DOTGOV_REGISTRY_MISSING_${required.replace(/\s+/g,'_').toUpperCase()}`)
  }

  const out:DotGovRegistryRecord[]=[]
  for(const line of lines.slice(1)){
    const cells=parseCsvLine(line)
    const domain=(cells[index('Domain name')]??'').trim().toLowerCase()
    const rawDomainType=(cells[index('Domain type')]??'').trim()
    const organization=(cells[index('Organization name')]??'').trim()
    const stateRaw=(cells[index('State')]??'').trim().toUpperCase()
    if(!domain.endsWith('.gov')||!organization)continue
    const state=stateCodes.has(stateRaw as UsStateOrDcCode)?stateRaw as UsStateOrDcCode:undefined
    out.push({
      domain,
      rawDomainType,
      domainType:classifyDotGovDomainType(rawDomainType),
      organization,
      suborganization:(cells[index('Suborganization name')]??'').trim()||undefined,
      city:(cells[index('City')]??'').trim()||undefined,
      state,
    })
  }
  return out
}

export function normalizeGovernmentOrganization(value:string):string{
  return value
    .toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\b(the|government of|state of|commonwealth of|county of|city of|town of|village of|borough of)\b/g,' ')
    .replace(/\b(board of commissioners|board of supervisors|county commissioners|commissioners|government|municipality)\b/g,' ')
    .replace(/\b(unified school district|independent school district|school district|public schools|school system|schools)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim()
}

function expectedLevel(type:DotGovDomainType):PublicJurisdictionLevel|undefined{
  if(type==='state')return'state'
  if(type==='county')return'county'
  if(type==='city')return'city'
  if(type==='school_district')return'school_district'
  if(type==='special_district')return'special_district'
  return undefined
}

export function matchDotGovDomainToJurisdiction(
  record:DotGovRegistryRecord,
  jurisdictions:DotGovJurisdictionMatchInput[],
):DotGovJurisdictionMatch|undefined{
  if(!record.state)return undefined
  const level=expectedLevel(record.domainType)
  if(!level)return undefined
  const candidates=jurisdictions.filter(row=>row.level===level&&row.state===record.state)
  if(!candidates.length)return undefined

  const org=normalizeGovernmentOrganization(record.organization)
  const city=normalizeGovernmentOrganization(record.city??'')
  let best:DotGovJurisdictionMatch|undefined

  for(const row of candidates){
    const normalized=normalizeGovernmentOrganization(row.normalizedName||row.name)
    const full=normalizeGovernmentOrganization(row.name)
    let score=0
    let reason=''

    if(org&&org===normalized){
      score=1
      reason='normalized_organization_exact'
    }else if(org&&org===full){
      score=0.99
      reason='organization_exact'
    }else if(
      level==='school_district'&&
      org&&
      org===normalized.replace(/\b(unified|independent|consolidated)\b/g,' ').replace(/\s+/g,' ').trim()
    ){
      score=0.97
      reason='school_district_qualifier_normalized'
    }else if(level==='city'&&city&&city===normalized&&org.includes(normalized)){
      score=0.94
      reason='city_and_organization_match'
    }else if(org&&normalized&&org.includes(normalized)&&normalized.length>=5){
      score=0.86
      reason='organization_contains_jurisdiction'
    }else{
      continue
    }

    if(!best||score>best.score)best={jurisdictionId:row.id,score,reason}
  }

  return best&&best.score>=0.86?best:undefined
}
