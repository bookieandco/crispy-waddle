import type {
  PublicOpportunitySignal,
  PublicProcurementSource,
} from './public-opportunity-grid.js'

export type PublicSourceCheckpoint = {
  sourceId:string
  cursor?:string
  lastExternalId?:string
  lastObservedAt?:string
  metadata?:Record<string,string|number|boolean>
}

export type PublicSourceHealthStatus='healthy'|'degraded'|'failed'|'disabled'

export type PublicSourceHealth = {
  sourceId:string
  status:PublicSourceHealthStatus
  checkedAt:string
  lastSuccessAt?:string
  lastErrorAt?:string
  consecutiveFailures:number
  observations:number
  errorCode?:string
}

export type PublicSourceFetchResult = {
  sourceId:string
  signals:PublicOpportunitySignal[]
  checkpoint:PublicSourceCheckpoint
  fetchedAt:string
  evidenceRefs:string[]
}

export type PublicSourceAdapter = {
  sourceId:string
  fetch(input:{
    source:PublicProcurementSource
    checkpoint?:PublicSourceCheckpoint
    now:string
  }):Promise<PublicSourceFetchResult>
}

export type PublicSourceScanResult = {
  sourceId:string
  signals:PublicOpportunitySignal[]
  checkpoint:PublicSourceCheckpoint
  health:PublicSourceHealth
  evidenceRefs:string[]
  automaticDiscoveryAuthorized:true
  externalContactAuthorized:false
  bidSubmissionAuthorized:false
}

function uniq(values:string[]):string[]{return [...new Set(values.filter(Boolean))]}

export async function runPublicSourceScan(input:{
  source:PublicProcurementSource
  adapter:PublicSourceAdapter
  checkpoint?:PublicSourceCheckpoint
  previousHealth?:PublicSourceHealth
  now?:string
}):Promise<PublicSourceScanResult>{
  const now=input.now??new Date().toISOString()
  if(input.source.status==='disabled'){
    return {
      sourceId:input.source.id,
      signals:[],
      checkpoint:input.checkpoint??{sourceId:input.source.id},
      health:{
        sourceId:input.source.id,
        status:'disabled',
        checkedAt:now,
        lastSuccessAt:input.previousHealth?.lastSuccessAt,
        lastErrorAt:input.previousHealth?.lastErrorAt,
        consecutiveFailures:input.previousHealth?.consecutiveFailures??0,
        observations:0,
      },
      evidenceRefs:[],
      automaticDiscoveryAuthorized:true,
      externalContactAuthorized:false,
      bidSubmissionAuthorized:false,
    }
  }
  if(input.adapter.sourceId!==input.source.id)throw new Error('Public source adapter/source mismatch.')

  try{
    const result=await input.adapter.fetch({source:input.source,checkpoint:input.checkpoint,now})
    if(result.sourceId!==input.source.id)throw new Error('Public source adapter returned the wrong sourceId.')
    const invalid=result.signals.find(signal=>signal.sourceId!==input.source.id||!signal.evidenceRef||!signal.sourceUrl)
    if(invalid)throw new Error('Public source adapter returned a signal without matching source/provenance.')
    return {
      sourceId:input.source.id,
      signals:result.signals,
      checkpoint:{...result.checkpoint,sourceId:input.source.id},
      health:{
        sourceId:input.source.id,
        status:'healthy',
        checkedAt:now,
        lastSuccessAt:now,
        lastErrorAt:input.previousHealth?.lastErrorAt,
        consecutiveFailures:0,
        observations:result.signals.length,
      },
      evidenceRefs:uniq(result.evidenceRefs.concat(result.signals.map(signal=>signal.evidenceRef))),
      automaticDiscoveryAuthorized:true,
      externalContactAuthorized:false,
      bidSubmissionAuthorized:false,
    }
  }catch(error){
    const failures=(input.previousHealth?.consecutiveFailures??0)+1
    return {
      sourceId:input.source.id,
      signals:[],
      checkpoint:input.checkpoint??{sourceId:input.source.id},
      health:{
        sourceId:input.source.id,
        status:failures>=3?'failed':'degraded',
        checkedAt:now,
        lastSuccessAt:input.previousHealth?.lastSuccessAt,
        lastErrorAt:now,
        consecutiveFailures:failures,
        observations:0,
        errorCode:error instanceof Error?error.message:'public_source_unknown_failure',
      },
      evidenceRefs:[],
      automaticDiscoveryAuthorized:true,
      externalContactAuthorized:false,
      bidSubmissionAuthorized:false,
    }
  }
}
