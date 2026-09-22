import type { BrokerProviderCandidate } from '@jhadina/opportunity-core'

const FMCSA_DATA_URL='https://data.transportation.gov/resource/az4n-8mr2.json'
const FMCSA_LANDING_URL='https://catalog.data.gov/dataset/company-census-file'
const FSIS_MPI_INFO_URL='https://www.fsis.usda.gov/inspection/establishments/meat-poultry-and-egg-product-inspection-directory'
const FSIS_DATASET_URL='https://catalog.data.gov/dataset/fsis-mpi-meat-poultry-and-egg-inspection-directory-by-establishment-name'

const uniq=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))]
const text=(value:unknown)=>typeof value==='string'?value.trim():''
const key=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,120)
const normalizeHeader=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'')

function parseCsvRows(input:string):Record<string,string>[]{
  const rows:string[][]=[]
  let row:string[]=[],field='',quoted=false
  const source=input.replace(/^\uFEFF/,'')
  for(let i=0;i<source.length;i+=1){
    const ch=source[i]
    if(quoted){
      if(ch==='"'&&source[i+1]==='"'){field+='"';i+=1}
      else if(ch==='"')quoted=false
      else field+=ch
      continue
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){row.push(field);field='';continue}
    if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';continue}
    if(ch!=='\r')field+=ch
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  const header=rows.shift()?.map(value=>value.trim())??[]
  return rows
    .filter(values=>values.some(Boolean))
    .map(values=>Object.fromEntries(header.map((name,index)=>[name,values[index]??''])))
}

function pick(row:Record<string,string>,patterns:RegExp[]){
  for(const [name,value] of Object.entries(row)){
    const normalized=normalizeHeader(name)
    if(patterns.some(pattern=>pattern.test(normalized))&&value.trim())return value.trim()
  }
  return ''
}

function significantTerms(values:string[]){
  const stop=new Set(['the','and','for','with','from','shall','must','provide','supply','services','service','contractor','contract','required','requirements'])
  return uniq(values.flatMap(value=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/)))
    .filter(term=>term.length>=3&&!stop.has(term))
    .slice(0,16)
}

type FmcsaCargoField={
  field:string
  label:string
  pattern:RegExp
}
const FMCSA_CARGO_FIELDS:FmcsaCargoField[]=[
  {field:'crgo_coldfood',label:'refrigerated food',pattern:/\b(cold|cold-chain|refrigerat|frozen|perishable)\b/i},
  {field:'crgo_meat',label:'meat',pattern:/\b(meat|beef|pork|sausage|protein)\b/i},
  {field:'crgo_produce',label:'produce',pattern:/\b(produce|fruit|vegetable|fresh food)\b/i},
  {field:'crgo_beverages',label:'beverages',pattern:/\b(beverage|drink|juice|water)\b/i},
  {field:'crgo_grainfeed',label:'grain/feed',pattern:/\b(grain|feed|flour|corn|wheat)\b/i},
  {field:'crgo_genfreight',label:'general freight',pattern:/\b(logistics|freight|transport|trucking|delivery|distribution|carrier)\b/i},
]

export function fmcsaCargoIntent(keywords:string[]){
  const hay=keywords.join(' ')
  return FMCSA_CARGO_FIELDS.filter(item=>item.pattern.test(hay))
}
export function shouldSearchFmcsa(keywords:string[]){return fmcsaCargoIntent(keywords).length>0}

export function parseFmcsaProviders(body:unknown,cargoIntent:FmcsaCargoField[],limit=30):BrokerProviderCandidate[]{
  if(!Array.isArray(body))return[]
  const out:BrokerProviderCandidate[]=[]
  for(const value of body){
    if(!value||typeof value!=='object')continue
    const row=value as Record<string,unknown>
    const legalName=text(row.legal_name)||text(row.dba_name)
    const dot=text(row.dot_number)
    if(!legalName||!dot)continue
    const country=(text(row.phy_country)||'US').toUpperCase()
    if(country!=='US')continue
    const status=text(row.status_code).toUpperCase()
    if(status&&status!=='A')continue
    const cargo=cargoIntent.filter(item=>text(row[item.field]).toUpperCase()==='X').map(item=>item.label)
    if(cargoIntent.length&&!cargo.length)continue
    const state=text(row.phy_state)
    const city=text(row.phy_city)
    out.push({
      id:'provider:fmcsa:'+dot,
      legalName,
      country:'US',
      naicsCodes:[],
      keywords:uniq([legalName,text(row.dba_name),city,state,...cargo,text(row.crgo_cargoothr_desc)]),
      evidence:[{
        id:'fmcsa:'+dot,
        source:'fmcsa_carrier',
        url:FMCSA_LANDING_URL,
        details:{
          usdot:dot,
          entityStatus:status||null,
          carrierOperation:text(row.carrier_operation)||null,
          carship:text(row.carship)||null,
          city:city||null,
          state:state||null,
          phone:text(row.phone)||null,
          email:text(row.email_address)||null,
          powerUnits:Number(text(row.power_units))||null,
          truckUnits:Number(text(row.truck_units))||null,
          totalDrivers:Number(text(row.total_drivers))||null,
          fleetSize:text(row.fleetsize)||null,
          cargo,
          docket1:text(row.docket1prefix)&&text(row.docket1)?text(row.docket1prefix)+text(row.docket1):null,
          docket1Status:text(row.docket1_status_code)||null,
          safetyRating:text(row.safety_rating)||null,
          sourceFreshness:'Company Census File is updated daily from a roughly 24-hour-old FMCSA database.',
          safetyInterpretation:'informational_only',
        },
      }],
    })
    if(out.length>=Math.max(1,Math.min(limit,100)))break
  }
  return out
}

export async function searchFmcsaProviders(input:{keywords:string[];limit?:number}):Promise<BrokerProviderCandidate[]>{
  const cargoIntent=fmcsaCargoIntent(input.keywords)
  if(!cargoIntent.length)return[]
  const url=new URL(FMCSA_DATA_URL)
  const limit=Math.max(1,Math.min(Math.floor(input.limit??30),100))
  const cargoWhere=cargoIntent.map(item=>item.field+"='X'").join(' OR ')
  url.searchParams.set('$where',"status_code='A' AND phy_country='US' AND ("+cargoWhere+")")
  url.searchParams.set('$order','power_units DESC')
  url.searchParams.set('$limit',String(limit))
  const headers:Record<string,string>={accept:'application/json'}
  const appToken=process.env.FMCSA_APP_TOKEN?.trim()
  if(appToken)headers['X-App-Token']=appToken
  const response=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('FMCSA_HTTP_'+response.status)
  return parseFmcsaProviders(await response.json(),cargoIntent,limit)
}

const FSIS_RELEVANT=/\b(meat|beef|pork|ham|sausage|poultry|chicken|turkey|duck|egg|eggs|slaughter|ready[- ]?to[- ]?eat|rte|raw intact|raw non[- ]?intact)\b/i
export function shouldSearchFsis(keywords:string[]){return FSIS_RELEVANT.test(keywords.join(' '))}

function fsisEstablishmentId(row:Record<string,string>){
  return pick(row,[/^estnumber$/,/establishmentnumber/,/^estno$/,/establishmentid/]).replace(/\s+/g,'')
}
function fsisCompany(row:Record<string,string>){
  return pick(row,[/^company$/,/companyname/,/establishmentname/,/^name$/])
}
function demographicByEstablishment(csv:string){
  const map=new Map<string,Record<string,string>>()
  for(const row of parseCsvRows(csv)){
    const id=fsisEstablishmentId(row)
    if(id)map.set(id,row)
  }
  return map
}
function rowSearchText(row:Record<string,string>){
  return Object.values(row).filter(Boolean).join(' ').toLowerCase()
}

export function parseFsisProviders(input:{
  directoryCsv:string
  demographicCsv?:string
  keywords:string[]
  limit?:number
}):BrokerProviderCandidate[]{
  if(!shouldSearchFsis(input.keywords))return[]
  const terms=significantTerms(input.keywords)
  const demographics=input.demographicCsv?demographicByEstablishment(input.demographicCsv):new Map<string,Record<string,string>>()
  const out:BrokerProviderCandidate[]=[]
  for(const row of parseCsvRows(input.directoryCsv)){
    const id=fsisEstablishmentId(row)
    const company=fsisCompany(row)
    if(!id||!company)continue
    const demographic=demographics.get(id)??{}
    const hay=(rowSearchText(row)+' '+rowSearchText(demographic)).trim()
    const query=input.keywords.join(' ')
    const relevant=terms.some(term=>hay.includes(term))||
      (/\b(meat|beef|pork|ham|sausage)\b/i.test(query)&&/\b(meat|beef|pork|livestock|raw|rte)\b/i.test(hay))||
      (/\b(poultry|chicken|turkey|duck)\b/i.test(query)&&/\b(poultry|chicken|turkey|duck)\b/i.test(hay))||
      (/\beggs?\b/i.test(query)&&/\begg\b/i.test(hay))
    if(!relevant)continue

    const city=pick(row,[/^city$/])
    const state=pick(row,[/^state$/])
    const phone=pick(row,[/^phone$/,/telephone/])
    const size=pick(demographic,[/haccpsize/,/establishmentsize/,/^size$/])
    const activities=Object.entries(demographic)
      .filter(([,value])=>/^(yes|y|x|true|1)$/i.test(value.trim()))
      .map(([name])=>name.replace(/[_-]+/g,' '))
      .slice(0,30)

    out.push({
      id:'provider:fsis:'+key(id),
      legalName:company,
      country:'US',
      naicsCodes:[],
      keywords:uniq([company,city,state,size,...activities]),
      evidence:[{
        id:'fsis:'+id,
        source:'fsis_establishment',
        url:FSIS_MPI_INFO_URL,
        details:{
          establishmentNumber:id,
          city:city||null,
          state:state||null,
          phone:phone||null,
          haccpSize:size||null,
          activities,
          federallyInspectedEstablishment:true,
          datasetLicence:'CC0 / public domain metadata via Data.gov',
          productSpecificCapability:'review_required',
        },
      }],
    })
    if(out.length>=Math.max(1,Math.min(Math.floor(input.limit??30),100)))break
  }
  return out
}

let fsisDirectoryPromise:Promise<string>|null=null
let fsisDemographicPromise:Promise<string>|null=null
async function cachedFsisCsv(kind:'directory'|'demographic',url:string){
  const current=kind==='directory'?fsisDirectoryPromise:fsisDemographicPromise
  if(current)return current
  const load=(async()=>{
    const response=await fetch(url,{headers:{accept:'text/csv,text/plain,*/*'},cache:'force-cache',signal:AbortSignal.timeout(30000)})
    if(!response.ok)throw new Error('FSIS_HTTP_'+response.status)
    return response.text()
  })()
  if(kind==='directory')fsisDirectoryPromise=load
  else fsisDemographicPromise=load
  try{return await load}catch(error){
    if(kind==='directory')fsisDirectoryPromise=null
    else fsisDemographicPromise=null
    throw error
  }
}

export async function searchConfiguredFsisProviders(input:{keywords:string[];limit?:number}):Promise<BrokerProviderCandidate[]>{
  const directoryUrl=process.env.FSIS_MPI_CSV_URL?.trim()
  if(!directoryUrl||!shouldSearchFsis(input.keywords))return[]
  const demographicUrl=process.env.FSIS_MPI_DEMOGRAPHIC_CSV_URL?.trim()
  const directoryCsv=await cachedFsisCsv('directory',directoryUrl)
  const demographicCsv=demographicUrl?await cachedFsisCsv('demographic',demographicUrl):undefined
  return parseFsisProviders({directoryCsv,demographicCsv,keywords:input.keywords,limit:input.limit})
}

export const usProviderSourceMetadata={
  fmcsa:{source:'FMCSA Company Census File',url:FMCSA_LANDING_URL,api:FMCSA_DATA_URL},
  fsis:{source:'USDA FSIS Meat, Poultry and Egg Product Inspection Directory',url:FSIS_DATASET_URL},
}
