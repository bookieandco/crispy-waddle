import type {ExternalSignalPlatform} from './external-signal-ingest'

export type ExternalSignalSourceNode=Readonly<{
  sourceId:string
  platform:ExternalSignalPlatform
  sourceFamilyId?:string
  upstreamOriginId?:string
  contentFingerprint?:string
  evidenceIds:readonly string[]
}>

export type ExternalSignalIndependenceGroup=Readonly<{
  groupId:string
  sourceIds:readonly string[]
  reasons:readonly string[]
}>

export type ExternalSignalIndependenceAssessment=Readonly<{
  rawSourceCount:number
  independentGroupCount:number
  independenceRatio:number
  duplicateRisk:'LOW'|'MEDIUM'|'HIGH'
  groups:readonly ExternalSignalIndependenceGroup[]
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

const norm=(value:string|undefined)=>value?.trim().toLowerCase()||undefined

export function assessExternalSignalIndependence(
  input:readonly ExternalSignalSourceNode[],
):ExternalSignalIndependenceAssessment{
  if(!input.length)throw new Error('external_signal_independence_sources_required')
  const ids=input.map(source=>source.sourceId.trim())
  if(ids.some(id=>!id))throw new Error('external_signal_independence_source_id_required')
  if(new Set(ids).size!==ids.length)throw new Error('external_signal_independence_source_id_duplicate')
  if(input.some(source=>!source.evidenceIds.length))throw new Error('external_signal_independence_evidence_required')

  const parent=new Map(ids.map(id=>[id,id]))
  const find=(id:string):string=>{
    let root=parent.get(id)!
    while(root!==parent.get(root)!)root=parent.get(root)!
    let cursor=id
    while(parent.get(cursor)!==root){const next=parent.get(cursor)!;parent.set(cursor,root);cursor=next}
    return root
  }
  const union=(a:string,b:string)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra)}

  for(let i=0;i<input.length;i++){
    for(let j=i+1;j<input.length;j++){
      const a=input[i]!,b=input[j]!
      const sameFamily=norm(a.sourceFamilyId)!==undefined&&norm(a.sourceFamilyId)===norm(b.sourceFamilyId)
      const sameOrigin=norm(a.upstreamOriginId)!==undefined&&norm(a.upstreamOriginId)===norm(b.upstreamOriginId)
      const sameContent=norm(a.contentFingerprint)!==undefined&&norm(a.contentFingerprint)===norm(b.contentFingerprint)
      if(sameFamily||sameOrigin||sameContent)union(a.sourceId.trim(),b.sourceId.trim())
    }
  }

  const buckets=new Map<string,ExternalSignalSourceNode[]>()
  for(const source of input){
    const root=find(source.sourceId.trim())
    buckets.set(root,[...(buckets.get(root)??[]),source])
  }
  const groups=[...buckets.values()].map((sources,index)=>{
    const reasons=new Set<string>()
    if(new Set(sources.map(source=>norm(source.sourceFamilyId)).filter(Boolean)).size===1&&sources.length>1)reasons.add('shared-source-family')
    if(new Set(sources.map(source=>norm(source.upstreamOriginId)).filter(Boolean)).size===1&&sources.length>1)reasons.add('shared-upstream-origin')
    if(new Set(sources.map(source=>norm(source.contentFingerprint)).filter(Boolean)).size===1&&sources.length>1)reasons.add('duplicate-or-cross-post-content')
    return Object.freeze({
      groupId:`external-signal-group:${index+1}`,
      sourceIds:Object.freeze(sources.map(source=>source.sourceId).sort()),
      reasons:Object.freeze([...reasons].sort()),
    })
  }).sort((a,b)=>a.sourceIds[0]!.localeCompare(b.sourceIds[0]!))

  const rawSourceCount=input.length
  const independentGroupCount=groups.length
  const independenceRatio=independentGroupCount/rawSourceCount
  const duplicateRisk=independenceRatio>=0.8?'LOW':independenceRatio>=0.5?'MEDIUM':'HIGH'
  return Object.freeze({
    rawSourceCount,
    independentGroupCount,
    independenceRatio,
    duplicateRisk,
    groups:Object.freeze(groups),
    evidenceIds:Object.freeze([...new Set(input.flatMap(source=>source.evidenceIds))].sort()),
    authority:'EVIDENCE_ONLY',
    canAuthorizeTrade:false,
  })
}
