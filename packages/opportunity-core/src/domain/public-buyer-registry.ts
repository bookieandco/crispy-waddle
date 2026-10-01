import type { UsStateOrDcCode } from './public-opportunity-grid.js'

export type PublicHospitalRegistryRecord={
  facilityId:string
  name:string
  state:UsStateOrDcCode
  city:string
  county?:string
  ownership:string
  sourceUrl:string
  officialDomainHints:string[]
}

export type PublicHigherEdRegistryRecord={
  unitId:string
  name:string
  state:UsStateOrDcCode
  city:string
  control:'public'
  website?:string
  latitude?:number
  longitude?:number
  sourceUrl:string
  officialDomainHints:string[]
}

export type GovernmentUnitsSchemaProbe={
  headers:string[]
  recognized:{
    governmentId?:string
    governmentName?:string
    governmentType?:string
    state?:string
    county?:string
    function?:string
  }
  status:'READY_FOR_FIXTURE_REVIEW'|'SCHEMA_UNRESOLVED'
  blockers:string[]
}

const STATE_CODES=new Set<UsStateOrDcCode>([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
])

const clean=(value:unknown)=>typeof value==='string'?value.trim():''
const lower=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')

function state(value:unknown):UsStateOrDcCode|undefined{
  const code=clean(value).toUpperCase() as UsStateOrDcCode
  return STATE_CODES.has(code)?code:undefined
}

function domainHint(raw:string|undefined):string|undefined{
  if(!raw)return undefined
  let value=raw.trim()
  if(!value)return undefined
  if(!/^https?:\/\//i.test(value))value=`https://${value}`
  try{
    const host=new URL(value).hostname.toLowerCase().replace(/^www\./,'').replace(/\.$/,'')
    return host||undefined
  }catch{return undefined}
}

export function parseCmsGovernmentHospitals(
  payload:unknown,
  sourceUrl='https://data.cms.gov/provider-data/dataset/xubh-q36u',
):PublicHospitalRegistryRecord[]{
  if(!payload||typeof payload!=='object')return[]
  const results=Array.isArray((payload as {results?:unknown}).results)
    ?(payload as {results:unknown[]}).results
    :[]
  const out:PublicHospitalRegistryRecord[]=[]
  for(const raw of results){
    if(!raw||typeof raw!=='object')continue
    const row=raw as Record<string,unknown>
    const ownership=clean(row.hospital_ownership)
    if(!ownership.toLowerCase().startsWith('government -'))continue
    const facilityId=clean(row.facility_id)
    const name=clean(row.facility_name)
    const st=state(row.state)
    const city=clean(row.citytown)
    if(!facilityId||!name||!st||!city)continue
    out.push({
      facilityId,
      name,
      state:st,
      city,
      county:clean(row.countyparish)||undefined,
      ownership,
      sourceUrl,
      officialDomainHints:[],
    })
  }
  return out
}

export function parseCsvRows(csv:string):Array<Record<string,string>>{
  const rows:string[][]=[]
  let row:string[]=[]
  let field=''
  let quoted=false
  for(let i=0;i<csv.length;i+=1){
    const ch=csv[i]!
    if(quoted){
      if(ch==='"'&&csv[i+1]==='"'){field+='"';i+=1;continue}
      if(ch==='"'){quoted=false;continue}
      field+=ch
      continue
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){row.push(field);field='';continue}
    if(ch==='\n'){
      row.push(field.replace(/\r$/,''))
      field=''
      if(row.some(value=>value.trim()))rows.push(row)
      row=[]
      continue
    }
    field+=ch
  }
  row.push(field.replace(/\r$/,''))
  if(row.some(value=>value.trim()))rows.push(row)
  if(rows.length<2)return[]
  const headers=rows[0]!.map(value=>value.replace(/^\uFEFF/,'').trim())
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]?.trim()??''])))
}

function rowValue(row:Record<string,string>,name:string):string{
  const direct=row[name]
  if(direct!==undefined)return direct
  const wanted=lower(name)
  const found=Object.keys(row).find(key=>lower(key)===wanted)
  return found?row[found]??'':''
}

export function parseIpedsPublicInstitutions(
  csv:string,
  sourceUrl:string,
):PublicHigherEdRegistryRecord[]{
  const out:PublicHigherEdRegistryRecord[]=[]
  for(const row of parseCsvRows(csv)){
    const control=rowValue(row,'CONTROL')
    if(control!=='1')continue
    const unitId=rowValue(row,'UNITID')
    const name=rowValue(row,'INSTNM')
    const st=state(rowValue(row,'STABBR'))
    const city=rowValue(row,'CITY')
    if(!unitId||!name||!st||!city)continue
    const rawWebsite=rowValue(row,'WEBADDR')
    let website:string|undefined
    if(rawWebsite){
      website=/^https?:\/\//i.test(rawWebsite)?rawWebsite:`https://${rawWebsite}`
      try{new URL(website)}catch{website=undefined}
    }
    const lat=Number(rowValue(row,'LATITUDE'))
    const long=Number(rowValue(row,'LONGITUD'))
    const hint=domainHint(website)
    out.push({
      unitId,
      name,
      state:st,
      city,
      control:'public',
      website,
      latitude:Number.isFinite(lat)?lat:undefined,
      longitude:Number.isFinite(long)?long:undefined,
      sourceUrl,
      officialDomainHints:hint?[hint]:[],
    })
  }
  return out
}

const aliases={
  governmentId:['govid','government_id','governmentid','unit_id','unitid'],
  governmentName:['name','government_name','governmentname','govname'],
  governmentType:['type','government_type','governmenttype','govtype'],
  state:['state','state_code','statecode','state_fips','statefp'],
  county:['county','county_code','countycode','county_fips','countyfp'],
  function:['function','function_code','functioncode','func','funccode'],
} as const

export function probeGovernmentUnitsSchema(csv:string):GovernmentUnitsSchemaProbe{
  const firstLine=csv.replace(/^\uFEFF/,'').split(/\r?\n/).find(line=>line.trim())??''
  const separator=firstLine.includes('|')?'|':','
  const headers=(separator==='|'?firstLine.split('|'):parseCsvHeader(firstLine)).map(value=>value.trim()).filter(Boolean)
  const normalized=new Map(headers.map(header=>[lower(header),header]))
  const recognized:GovernmentUnitsSchemaProbe['recognized']={}
  for(const [field,candidates] of Object.entries(aliases) as Array<[keyof GovernmentUnitsSchemaProbe['recognized'],readonly string[]]>){
    for(const candidate of candidates){
      const hit=normalized.get(lower(candidate))
      if(hit){recognized[field]=hit;break}
    }
  }
  const blockers:string[]=[]
  if(!recognized.governmentId)blockers.push('No recognized government identifier column.')
  if(!recognized.governmentName)blockers.push('No recognized government name column.')
  if(!recognized.governmentType)blockers.push('No recognized government type column.')
  if(!recognized.state)blockers.push('No recognized state column.')
  return {
    headers,
    recognized,
    status:blockers.length?'SCHEMA_UNRESOLVED':'READY_FOR_FIXTURE_REVIEW',
    blockers,
  }
}

function parseCsvHeader(line:string):string[]{
  return splitCsvHeader(line)
}

function splitCsvHeader(line:string):string[]{
  const values:string[]=[]
  let field=''
  let quoted=false
  for(let i=0;i<line.length;i+=1){
    const ch=line[i]!
    if(quoted){
      if(ch==='"'&&line[i+1]==='"'){field+='"';i+=1;continue}
      if(ch==='"'){quoted=false;continue}
      field+=ch
      continue
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){values.push(field);field='';continue}
    field+=ch
  }
  values.push(field)
  return values
}
