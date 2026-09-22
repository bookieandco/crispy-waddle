export type SamAgencyKind='dod'|'civilian'|'unknown'
export type SamContractKind='service'|'supply'|'general_construction'|'specialty_construction'|'mixed'|'unknown'
export type SubcontractabilityInput={
  agencyKind:SamAgencyKind
  contractKind:SamContractKind
  isFood:boolean
  setAside?:string
  clauses:string[]
  providerCountry?:string
  productCountry?:string
  proposedNonSimilarlySituatedSharePct?:number
  similarlySituatedProvider?:boolean
  primeIsManufacturer?:boolean
  manufacturerIsUsSmallBusiness?:boolean
  domesticPreferenceException?:boolean
  nonmanufacturerWaiver?:boolean
}
export type SubcontractabilityDecision={
  status:'pass'|'conditional'|'review_required'|'blocked'
  hardBlockers:string[]
  conditions:string[]
  detectedRules:string[]
  maxNonSimilarlySituatedSharePct?:number
  foreignProviderPermittedInPrinciple:boolean
  humanReviewRequired:true
}

const has=(clauses:string[],re:RegExp)=>clauses.some(x=>re.test(x))
export function normalizeCountryCode(value?:string){
  const normalized=value?.trim().toUpperCase().replace(/[^A-Z]/g,'')??''
  if(['US','USA','UNITEDSTATES','UNITEDSTATESOFAMERICA'].includes(normalized))return'US'
  if(['MX','MEX','MEXICO'].includes(normalized))return'MX'
  if(['CA','CAN','CANADA'].includes(normalized))return'CA'
  return normalized||undefined
}
export function isUsCountry(value?:string){return normalizeCountryCode(value)==='US'}
const limitFor=(kind:SamContractKind)=>kind==='general_construction'?85:kind==='specialty_construction'?75:kind==='service'||kind==='supply'?50:undefined

export function evaluateSamSubcontractability(input:SubcontractabilityInput):SubcontractabilityDecision{
  const clauses=input.clauses.map(x=>x.trim()).filter(Boolean)
  const hardBlockers:string[]=[],conditions:string[]=[],detectedRules:string[]=[]
  const setAside=Boolean(input.setAside?.trim())
  const foreignProvider=Boolean(input.providerCountry&&!isUsCountry(input.providerCountry))
  const berry=has(clauses,/252\.225-7012|berry amendment/i)
  const limitation=has(clauses,/52\.219-14|limitations? on subcontracting/i)||setAside
  const nonmanufacturer=has(clauses,/nonmanufacturer|52\.219-33/i)

  if(berry){detectedRules.push('DFARS/Berry domestic-source rule detected')}
  if(limitation){detectedRules.push('limitations-on-subcontracting analysis required')}
  if(nonmanufacturer){detectedRules.push('nonmanufacturer-rule analysis required')}

  if(input.isFood&&input.agencyKind==='dod'&&berry&&input.productCountry&&!isUsCountry(input.productCountry)&&!input.domesticPreferenceException){
    hardBlockers.push('Proposed non-U.S. food origin conflicts with detected DoD domestic-source requirement unless a solicitation-specific exception applies.')
  }

  const maxNonSimilarlySituatedSharePct=setAside&&limitation?limitFor(input.contractKind):undefined
  if(maxNonSimilarlySituatedSharePct!==undefined&&input.proposedNonSimilarlySituatedSharePct!==undefined&&input.proposedNonSimilarlySituatedSharePct>maxNonSimilarlySituatedSharePct){
    hardBlockers.push(`Proposed non-similarly-situated subcontract share ${input.proposedNonSimilarlySituatedSharePct}% exceeds modeled ${maxNonSimilarlySituatedSharePct}% ceiling.`)
  }

  if(setAside&&input.contractKind==='supply'&&nonmanufacturer&&input.primeIsManufacturer===false&&!input.nonmanufacturerWaiver){
    if(input.manufacturerIsUsSmallBusiness===false)hardBlockers.push('Detected nonmanufacturer rule is not satisfied by the proposed manufacturer and no waiver evidence is present.')
    else if(input.manufacturerIsUsSmallBusiness!==true)conditions.push('Verify manufacturer small-business status or obtain applicable SBA waiver evidence.')
  }

  if(foreignProvider){
    conditions.push('Foreign ownership alone is not treated as an automatic bar; verify solicitation-specific nationality, origin, security, export/import and place-of-performance restrictions.')
    if(input.isFood&&input.productCountry&&normalizeCountryCode(input.providerCountry)!==normalizeCountryCode(input.productCountry))conditions.push('Treat provider nationality and food/product origin as separate compliance facts.')
  }
  if(input.isFood)conditions.push('Verify food-safety, import, cold-chain and agency-specific source requirements from the solicitation.')

  const status=hardBlockers.length?'blocked':conditions.length?'conditional':clauses.length?'pass':'review_required'
  return {
    status,hardBlockers,conditions:[...new Set(conditions)],detectedRules:[...new Set(detectedRules)],
    maxNonSimilarlySituatedSharePct,foreignProviderPermittedInPrinciple:foreignProvider&&!hardBlockers.some(x=>/ownership|nationality/i.test(x)),
    humanReviewRequired:true,
  }
}
