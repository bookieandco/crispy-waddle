import { getSamApiKey } from './sam-config'
import { samUpstreamConfigured, searchSamAwardsViaUpstream } from './sam-upstream-client'

export type SamAwardSearchParams={
  limit?:number
  offset?:number
  awardeeUniqueEntityId?:string
  awardeeCageCode?:string
  naicsCode?:string
  productOrServiceCode?:string
  contractingDepartmentName?:string
  contractingSubtierName?:string
  contractingOfficeCode?:string
  approvedDate?:string
  dateSigned?:string
  typeOfSetAsideCode?:string
  awardOrIDV?:string
  includeSections?:string
}

export type SamAwardSearchPage={
  awardSummary?:Array<Record<string,unknown>>
  totalRecords?:number|string
  limit?:number|string
  offset?:number|string
  [key:string]:unknown
}

export type ParsedSamAwardProvider={
  providerName:string
  uei?:string
  cage?:string
  state?:string
  naicsCodes:string[]
  pscCodes:string[]
  agency?:string
  office?:string
  awardAmount?:number
  setAside?:string
  businessSize?:string
  awardId:string
  evidenceUrl:string
  raw:Record<string,unknown>
}

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
const text=(value:unknown)=>typeof value==='string'?value.trim():''
const number=(value:unknown)=>{
  if(typeof value==='number')return Number.isFinite(value)?value:undefined
  if(typeof value!=='string')return undefined
  const parsed=Number(value.replace(/[$,]/g,'').trim())
  return Number.isFinite(parsed)?parsed:undefined
}
const rows=(value:unknown)=>Array.isArray(value)?value.filter((row):row is Record<string,unknown>=>Boolean(row&&typeof row==='object'&&!Array.isArray(row))):[]

export async function searchSamContractAwards(params:SamAwardSearchParams={}):Promise<SamAwardSearchPage>{
  const apiKey=getSamApiKey()
  if(!apiKey){
    if(samUpstreamConfigured())return searchSamAwardsViaUpstream(params as Record<string,unknown>) as Promise<SamAwardSearchPage>
    throw new Error('sam_key is not configured for Contract Awards API')
  }
  const url=new URL('https://api.sam.gov/contract-awards/v1/search')
  url.searchParams.set('api_key',apiKey)
  url.searchParams.set('limit',String(Math.max(1,Math.min(params.limit??100,100))))
  url.searchParams.set('offset',String(Math.max(0,params.offset??0)))
  const allowed:Record<string,string|number|undefined>={
    awardeeUniqueEntityId:params.awardeeUniqueEntityId,
    awardeeCageCode:params.awardeeCageCode,
    naicsCode:params.naicsCode,
    productOrServiceCode:params.productOrServiceCode,
    contractingDepartmentName:params.contractingDepartmentName,
    contractingSubtierName:params.contractingSubtierName,
    contractingOfficeCode:params.contractingOfficeCode,
    approvedDate:params.approvedDate,
    dateSigned:params.dateSigned,
    typeOfSetAsideCode:params.typeOfSetAsideCode,
    awardOrIDV:params.awardOrIDV??'Award',
    includeSections:params.includeSections??'contractId,coreData,awardDetails',
  }
  for(const [key,value] of Object.entries(allowed)){
    if(value!==undefined&&String(value).trim())url.searchParams.set(key,String(value).trim())
  }
  const response=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(30_000)})
  if(!response.ok){
    await response.body?.cancel().catch(()=>undefined)
    throw new Error(`SAM_AWARD_HTTP_${response.status}`)
  }
  return response.json() as Promise<SamAwardSearchPage>
}

export function parseSamAwardProviders(body:SamAwardSearchPage):ParsedSamAwardProvider[]{
  const out:ParsedSamAwardProvider[]=[]
  for(const award of rows(body.awardSummary)){
    const contractId=object(award.contractId)
    const core=object(award.coreData)
    const awardDetails=object(award.awardDetails)
    const awardee=object(awardDetails.awardeeData)
    const header=object(awardee.awardeeHeader)
    const ueiInfo=object(awardee.awardeeUEIInformation)
    const location=object(awardee.awardeeLocation)
    const state=object(location.state)
    const federalOrg=object(core.federalOrganization)
    const contracting=object(federalOrg.contractingInformation)
    const department=object(contracting.contractingDepartment)
    const office=object(contracting.contractingOffice)
    const product=object(core.productOrServiceInformation)
    const psc=object(product.productOrService)
    const naics=rows(product.principalNaics).map(row=>text(row.code)).filter(Boolean)
    const competition=object(core.competitionInformation)
    const setAside=object(competition.typeOfSetAside)
    const preference=object(awardDetails.preferenceProgramsInformation)
    const businessSizeRows=rows(preference.contractingOfficerBusinessSizeDetermination)
    const dollars=object(awardDetails.totalContractDollars)
    const piid=text(contractId.piid)
    const modification=text(contractId.modificationNumber)
    const providerName=text(header.legalBusinessName)||text(header.awardeeName)||text(header.awardeeNameFromContract)
    if(!providerName)continue
    const awardId=[piid,modification].filter(Boolean).join(':')||text(contractId.transactionNumber)||providerName
    out.push({
      providerName,
      uei:text(ueiInfo.uniqueEntityId)||undefined,
      cage:text(ueiInfo.cageCode)||undefined,
      state:text(state.code)||undefined,
      naicsCodes:[...new Set(naics)],
      pscCodes:[text(psc.code)].filter(Boolean),
      agency:text(department.name)||undefined,
      office:text(office.name)||undefined,
      awardAmount:number(dollars.totalActionObligation),
      setAside:text(setAside.name)||text(setAside.code)||undefined,
      businessSize:text(businessSizeRows[0]?.name)||undefined,
      awardId,
      evidenceUrl:'https://sam.gov/contract-data',
      raw:award,
    })
  }
  return out
}
