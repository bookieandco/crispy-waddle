import crosswalk from '../data/naics-sic-crosswalk.json'
import type { BrokerRequirement } from './sam-provider-broker.js'

type CrosswalkEntry={
  sicCodes:string[]
  sicDescriptions:string[]
  naicsDescriptions:string[]
}
type CrosswalkData={
  source:string
  sourceRepository:string
  license:string
  mappings:number
  naics:Record<string,CrosswalkEntry>
}

const data=crosswalk as CrosswalkData
const uniq=(values:string[])=>[...new Set(values.map(v=>v.trim()).filter(Boolean))]
const stopwords=new Set([
  'the','and','for','with','from','that','this','shall','must','required','requirement','requirements',
  'contractor','government','provide','provides','providing','furnish','furnishes','furnishing','all',
  'services','service','products','product','work','including','include','includes','into','onto','within',
  'their','there','three','each','per','any','other','support','supply','supplies'
])

function significantWords(value:string){
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .split(/s+/)
    .filter(word=>word.length>2&&!stopwords.has(word))
    .slice(0,10)
}

function phraseAliases(label:string){
  const words=significantWords(label)
  const aliases:string[]=[]
  if(words.length>=2)aliases.push(words.slice(0,4).join(' '))
  for(let i=0;i<Math.min(words.length-1,5);i+=1)aliases.push(words.slice(i,i+2).join(' '))
  const hay=words.join(' ')
  if(/(food|grocery|meal|meat|produce|dairy)/.test(hay)){
    aliases.push('food supplier','food distributor','food wholesaler')
  }
  if(/(refrigerated|cold|frozen)/.test(hay)){
    aliases.push('cold chain logistics','refrigerated distribution')
  }
  if(/(delivery|logistics|freight|transport|shipping)/.test(hay)){
    aliases.push('logistics provider','freight carrier','distribution service')
  }
  if(/(construction|building|renovation|repair)/.test(hay)){
    aliases.push('general contractor','specialty contractor')
  }
  if(/(software|technology|cyber|network|computer|information)/.test(hay)){
    aliases.push('technology services','software company','IT contractor')
  }
  if(/(medical|health|hospital|clinical)/.test(hay)){
    aliases.push('medical supplier','healthcare services')
  }
  return uniq(aliases)
}

export type ProviderTaxonomyExpansion={
  naicsCodes:string[]
  sicCodes:string[]
  pscCodes:string[]
  keywords:string[]
  source:{
    crosswalk:string
    license:string
  }
}

export function expandProviderTaxonomy(requirement:BrokerRequirement):ProviderTaxonomyExpansion{
  const naicsCodes=uniq(requirement.naicsCodes??[])
  const entries=naicsCodes
    .map(code=>data.naics[code])
    .filter((entry):entry is CrosswalkEntry=>Boolean(entry))
  const sicCodes=uniq(entries.flatMap(entry=>entry.sicCodes))
  const crosswalkTerms=uniq(entries.flatMap(entry=>[
    ...entry.naicsDescriptions.slice(0,3),
    ...entry.sicDescriptions.slice(0,3),
  ]))
  const keywords=uniq([
    requirement.label,
    ...(requirement.keywords??[]),
    ...phraseAliases(requirement.label),
    ...crosswalkTerms,
  ]).slice(0,24)
  return {
    naicsCodes,
    sicCodes,
    pscCodes:uniq(requirement.pscCodes??[]),
    keywords,
    source:{
      crosswalk:data.sourceRepository,
      license:data.license,
    },
  }
}

export function providerTaxonomySource(){
  return {
    source:data.source,
    sourceRepository:data.sourceRepository,
    license:data.license,
    mappings:data.mappings,
  }
}
