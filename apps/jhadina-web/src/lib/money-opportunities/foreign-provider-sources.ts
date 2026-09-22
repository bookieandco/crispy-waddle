import type { BrokerProviderCandidate } from '@jhadina/opportunity-core'

const DENUE_DOC_URL='https://www.inegi.org.mx/servicios/api_denue.html'
const CANADA_CID_DATASET_URL='https://open.canada.ca/data/en/dataset/2e7c5a58-986f-402c-9dec-a45e0dadf8dd'
const DEFAULT_CID_HS6_DESCRIPTION_URL='https://ised-isde.canada.ca/site/ised/sites/default/files/documents/cid-bdic-hs6description2022.csv'
const DEFAULT_CID_IMPORTERS_HS6_URL='https://ised-isde.canada.ca/site/ised/sites/default/files/documents/cid-bdic-majorimportersbyhs62022.csv'
const CANADA_ODBUS_INFO_URL='https://www150.statcan.gc.ca/n1/pub/21-26-0003/212600032023001-eng.htm'

const text=(value:unknown)=>typeof value==='string'?value.trim():''
const key=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,120)
const uniq=(values:string[])=>[...new Set(values.map(value=>value.trim()).filter(Boolean))]

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
    if(ch==='\n'){
      row.push(field);rows.push(row);row=[];field='';continue
    }
    if(ch!=='\r')field+=ch
  }
  if(field.length||row.length){row.push(field);rows.push(row)}
  const header=rows.shift()?.map(value=>value.trim())??[]
  return rows
    .filter(values=>values.some(Boolean))
    .map(values=>Object.fromEntries(header.map((name,index)=>[name,values[index]??''])))
}

const normalizeHeader=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'')
function pick(row:Record<string,string>,patterns:RegExp[]){
  for(const [name,value] of Object.entries(row)){
    const normalized=normalizeHeader(name)
    if(patterns.some(pattern=>pattern.test(normalized))&&value.trim())return value.trim()
  }
  return ''
}
function significantTerms(values:string[]){
  const stop=new Set(['the','and','for','with','from','shall','must','provide','supply','services','service','contractor','contract','delivery','required','requirements'])
  return uniq(values.flatMap(value=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/)))
    .filter(term=>term.length>=4&&!stop.has(term))
    .slice(0,12)
}

export function parseDenueProviders(body:unknown,searchTerms:string[]):BrokerProviderCandidate[]{
  if(!Array.isArray(body))return[]
  const terms=significantTerms(searchTerms)
  const out:BrokerProviderCandidate[]=[]
  for(const value of body){
    if(!value||typeof value!=='object')continue
    const row=value as Record<string,unknown>
    const establishmentName=text(row.Nombre)
    const legalName=text(row.Razon_social)||establishmentName
    if(!legalName)continue
    const activity=text(row.Clase_actividad)
    const id=text(row.Id)||text(row.CLEE)||key(legalName)
    out.push({
      id:'provider:denue:'+id,
      legalName,
      country:'MEX',
      naicsCodes:[],
      keywords:uniq([establishmentName,legalName,activity,text(row.Ubicacion)]),
      evidence:[{
        id:'denue:'+id,
        source:'denue',
        url:DENUE_DOC_URL,
        details:{
          establishmentId:text(row.Id)||null,
          clee:text(row.CLEE)||null,
          establishmentName:establishmentName||null,
          legalName,
          activity:activity||null,
          employeeBand:text(row.Estrato)||null,
          location:text(row.Ubicacion)||null,
          phone:text(row.Telefono)||null,
          email:text(row.Correo_e)||null,
          website:text(row.Sitio_internet)||null,
          latitude:text(row.Latitud)||null,
          longitude:text(row.Longitud)||null,
          classificationSystem:'SCIAN/DENUE',
          naicsCompatibility:'review_required',
          searchTerms:terms,
        },
      }],
    })
  }
  return out
}

export async function searchDenueProviders(input:{keywords:string[];limit?:number}):Promise<BrokerProviderCandidate[]>{
  const token=process.env.INEGI_DENUE_TOKEN?.trim()
  if(!token)return[]
  const terms=uniq(input.keywords).slice(0,3)
  if(!terms.length)return[]
  const condition=encodeURIComponent(terms.join(','))
  const limit=Math.max(1,Math.min(Math.floor(input.limit??20),100))
  const url='https://www.inegi.org.mx/app/api/denue/v1/consulta/BuscarEntidad/'+condition+'/00/1/'+limit+'/'+encodeURIComponent(token)
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)})
  if(!response.ok)throw new Error('DENUE_HTTP_'+response.status)
  return parseDenueProviders(await response.json(),terms)
}

type CanadaCidMatch={hs6:string;description:string}
export function matchCanadaHs6Descriptions(csv:string,keywords:string[],limit=5):CanadaCidMatch[]{
  const terms=significantTerms(keywords)
  if(!terms.length)return[]
  return parseCsvRows(csv)
    .map(row=>{
      const rawHs6=pick(row,[/^hs6$/,/^hs6code$/,/^commoditycode$/]).replace(/\D/g,'')
      const hs6=rawHs6?rawHs6.padStart(6,'0').slice(-6):''
      const description=pick(row,[/hs6description/,/^description$/,/commoditydescription/,/productdescription/])
      const hay=description.toLowerCase()
      const score=terms.reduce((sum,term)=>sum+(hay.includes(term)?1:0),0)
      return {hs6,description,score}
    })
    .filter(row=>/^\d{6}$/.test(row.hs6)&&row.description&&row.score>0)
    .sort((a,b)=>b.score-a.score||a.hs6.localeCompare(b.hs6))
    .slice(0,Math.max(1,Math.min(limit,20)))
    .map(({hs6,description})=>({hs6,description}))
}

export function parseCanadaImporterProviders(importersCsv:string,matches:CanadaCidMatch[],limit=30):BrokerProviderCandidate[]{
  const descriptions=new Map(matches.map(match=>[match.hs6,match.description]))
  if(!descriptions.size)return[]
  const providers=new Map<string,BrokerProviderCandidate>()
  for(const row of parseCsvRows(importersCsv)){
    const rawHs6=pick(row,[/^hs6$/,/^hs6code$/,/^commoditycode$/]).replace(/\D/g,'')
    const hs6=rawHs6?rawHs6.padStart(6,'0').slice(-6):''
    const hsDescription=descriptions.get(hs6)
    if(!hsDescription)continue
    const name=pick(row,[/companyname/,/importername/,/majorimporter/,/^company$/,/^importer$/,/(?:business|firm)name/])
    if(!name)continue
    const city=pick(row,[/^city$/,/municipality/])
    const province=pick(row,[/^province$/,/^prov$/,/provincecode/])
    const identity=key(name)
    const evidenceId='canada-importer:'+hs6+':'+identity
    const evidence={
      id:evidenceId,
      source:'canada_importer' as const,
      url:CANADA_CID_DATASET_URL,
      details:{
        hs6,
        hsDescription,
        city:city||null,
        province:province||null,
        datasetYear:2022,
        licence:'Open Government Licence - Canada',
        evidenceRole:'historical_importer_directory',
        currentCapability:'review_required',
      },
    }
    const existing=providers.get(identity)
    if(existing){
      existing.keywords=uniq([...existing.keywords,hsDescription,'HS6 '+hs6,city,province])
      if(!existing.evidence.some(item=>item.id===evidenceId))existing.evidence.push(evidence)
      continue
    }
    providers.set(identity,{
      id:'provider:canada-importer:'+identity,
      legalName:name,
      country:'CAN',
      naicsCodes:[],
      keywords:uniq([name,hsDescription,'HS6 '+hs6,city,province]),
      evidence:[evidence],
    })
    if(providers.size>=limit)break
  }
  return [...providers.values()]
}

let canadaDescriptionPromise:Promise<string>|null=null
let canadaImporterPromise:Promise<string>|null=null
async function cachedText(kind:'descriptions'|'importers',url:string){
  const current=kind==='descriptions'?canadaDescriptionPromise:canadaImporterPromise
  if(current)return current
  const load=(async()=>{
    const response=await fetch(url,{headers:{accept:'text/csv,text/plain,*/*'},cache:'force-cache',signal:AbortSignal.timeout(30000)})
    if(!response.ok)throw new Error('CANADA_CID_HTTP_'+response.status)
    return response.text()
  })()
  if(kind==='descriptions')canadaDescriptionPromise=load
  else canadaImporterPromise=load
  try{return await load}catch(error){
    if(kind==='descriptions')canadaDescriptionPromise=null
    else canadaImporterPromise=null
    throw error
  }
}

export async function searchCanadaImporterProviders(input:{keywords:string[];limit?:number}):Promise<BrokerProviderCandidate[]>{
  const descriptionUrl=process.env.CANADA_CID_HS6_DESCRIPTION_URL?.trim()||DEFAULT_CID_HS6_DESCRIPTION_URL
  const importersUrl=process.env.CANADA_CID_IMPORTERS_HS6_URL?.trim()||DEFAULT_CID_IMPORTERS_HS6_URL
  const [descriptions,importers]=await Promise.all([
    cachedText('descriptions',descriptionUrl),
    cachedText('importers',importersUrl),
  ])
  const matches=matchCanadaHs6Descriptions(descriptions,input.keywords,5)
  return parseCanadaImporterProviders(importers,matches,Math.max(1,Math.min(Math.floor(input.limit??30),100)))
}

export function searchCanadaOdbusCsv(input:{csv:string;keywords:string[];naicsCodes?:string[];limit?:number}):BrokerProviderCandidate[]{
  const terms=significantTerms(input.keywords)
  const wantedNaics=uniq(input.naicsCodes??[])
  const out:BrokerProviderCandidate[]=[]
  for(const row of parseCsvRows(input.csv)){
    const name=pick(row,[/^name$/,/(?:business|company|establishment)name/])
    if(!name)continue
    const sector=pick(row,[/businesssector/,/industry/,/sector/])
    const naics=pick(row,[/^naics$/,/naicscode/,/industrycode/]).replace(/\D/g,'')
    const status=pick(row,[/^status$/,/businessstatus/])
    const province=pick(row,[/^province$/,/^prov$/])
    const municipality=pick(row,[/municipality/,/city/])
    const hay=[name,sector,province,municipality].join(' ').toLowerCase()
    const keywordMatch=terms.some(term=>hay.includes(term))
    const naicsMatch=wantedNaics.some(code=>naics===code||naics.startsWith(code)||code.startsWith(naics))
    if(!keywordMatch&&!naicsMatch)continue
    const identity=key(name)+'-'+key(province||municipality)
    out.push({
      id:'provider:canada-odbus:'+identity,
      legalName:name,
      country:'CAN',
      naicsCodes:naics?[naics]:[],
      keywords:uniq([name,sector,status,province,municipality]),
      evidence:[{
        id:'canada-odbus:'+identity,
        source:'canada_odbusiness',
        url:CANADA_ODBUS_INFO_URL,
        details:{
          businessSector:sector||null,
          naics:naics||null,
          status:status||null,
          province:province||null,
          municipality:municipality||null,
          licence:'Open Government Licence - Canada',
          coverageNote:'ODBus is a selection of Canadian businesses, not the complete Business Register.',
        },
      }],
    })
    if(out.length>=Math.max(1,Math.min(Math.floor(input.limit??30),100)))break
  }
  return out
}

let odbusPromise:Promise<string>|null=null
export async function searchConfiguredCanadaOdbusProviders(input:{keywords:string[];naicsCodes?:string[];limit?:number}):Promise<BrokerProviderCandidate[]>{
  const url=process.env.CANADA_ODBUS_CSV_URL?.trim()
  if(!url)return[]
  if(!odbusPromise){
    odbusPromise=(async()=>{
      const response=await fetch(url,{headers:{accept:'text/csv,text/plain,*/*'},cache:'force-cache',signal:AbortSignal.timeout(30000)})
      if(!response.ok)throw new Error('CANADA_ODBUS_HTTP_'+response.status)
      return response.text()
    })()
  }
  try{
    const csv=await odbusPromise
    return searchCanadaOdbusCsv({csv,...input})
  }catch(error){
    odbusPromise=null
    throw error
  }
}
