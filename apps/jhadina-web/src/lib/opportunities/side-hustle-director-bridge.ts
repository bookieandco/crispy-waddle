import {
  createDirectorArchetypePlan,
  type DirectorArchetypePlan,
  type DirectorProductionArchetype,
} from '@jhadina/director-core'
import type {SideHustleFamily} from '@jhadina/opportunity-core'

export type SideHustleDirectorFamily =
  | 'content_social'
  | 'creative_advertising'
  | 'media_production'
  | 'owned_media'
  | 'creator_monetization'

export type SideHustleDirectorFormat =
  | 'tiktok_short'
  | 'ugc_ad'
  | 'faceless_youtube'
  | 'music_video'
  | 'short_film'
  | 'feature_film'

export type SideHustleDirectorProductionPlan=Readonly<{
  id:string
  opportunityId:string
  family:SideHustleDirectorFamily
  sourceRef:string
  directorProjectId:string
  format:SideHustleDirectorFormat
  archetype:DirectorProductionArchetype
  archetypePlan:DirectorArchetypePlan
  aspectRatio:'9:16'|'16:9'|'1:1'
  targetRuntimeSeconds:number
  activeTask:string
  sourceRefs:readonly string[]
  rightsEvidenceRefs:readonly string[]
  evidenceRefs:readonly string[]
  productionQuality:boolean
  workstationHref:string
  authority:'PLANNING_ONLY'
  publicationAuthority:'NONE'
  paidMediaAuthority:'NONE'
}>

const FAMILY_SET=new Set<SideHustleFamily>([
  'content_social','creative_advertising','media_production','owned_media','creator_monetization',
])

const FORMAT:Readonly<Record<SideHustleDirectorFormat,Readonly<{
  archetype:DirectorProductionArchetype
  aspectRatio:'9:16'|'16:9'|'1:1'
  runtime:number
  label:string
  productionQuality:boolean
}>>>=Object.freeze({
  tiktok_short:Object.freeze({archetype:'ugc_ad',aspectRatio:'9:16',runtime:30,label:'TikTok/Shorts video',productionQuality:false}),
  ugc_ad:Object.freeze({archetype:'ugc_ad',aspectRatio:'9:16',runtime:30,label:'UGC advertisement',productionQuality:false}),
  faceless_youtube:Object.freeze({archetype:'faceless_youtube',aspectRatio:'16:9',runtime:600,label:'faceless YouTube video',productionQuality:false}),
  music_video:Object.freeze({archetype:'music_video',aspectRatio:'16:9',runtime:180,label:'music video',productionQuality:true}),
  short_film:Object.freeze({archetype:'short_film',aspectRatio:'16:9',runtime:600,label:'short film',productionQuality:true}),
  feature_film:Object.freeze({archetype:'film',aspectRatio:'16:9',runtime:5400,label:'feature film',productionQuality:true}),
})

export function compileSideHustleDirectorProductionPlan(input:{
  id:string
  opportunityId:string
  family:SideHustleFamily
  sourceRef:string
  directorProjectId:string
  format:SideHustleDirectorFormat
  intent:string
  sourceRefs:string[]
  rightsEvidenceRefs:string[]
  evidenceRefs:string[]
  targetRuntimeSeconds?:number
  aspectRatio?:'9:16'|'16:9'|'1:1'
  createdAt?:string
}):SideHustleDirectorProductionPlan{
  if(!FAMILY_SET.has(input.family))throw new Error('SIDE_HUSTLE_DIRECTOR_FAMILY_NOT_MEDIA_CAPABLE')
  const family=input.family as SideHustleDirectorFamily
  for(const [value,code] of [
    [input.id,'SIDE_HUSTLE_DIRECTOR_ID_REQUIRED'],
    [input.opportunityId,'SIDE_HUSTLE_DIRECTOR_OPPORTUNITY_REQUIRED'],
    [input.sourceRef,'SIDE_HUSTLE_DIRECTOR_SOURCE_REF_REQUIRED'],
    [input.directorProjectId,'SIDE_HUSTLE_DIRECTOR_PROJECT_REQUIRED'],
    [input.intent,'SIDE_HUSTLE_DIRECTOR_INTENT_REQUIRED'],
  ] as const){
    if(!value.trim())throw new Error(code)
  }
  if(!input.sourceRefs.length)throw new Error('SIDE_HUSTLE_DIRECTOR_SOURCE_EVIDENCE_REQUIRED')
  if(!input.rightsEvidenceRefs.length)throw new Error('SIDE_HUSTLE_DIRECTOR_RIGHTS_REQUIRED')
  if(!input.evidenceRefs.length)throw new Error('SIDE_HUSTLE_DIRECTOR_EVIDENCE_REQUIRED')

  const profile=FORMAT[input.format]
  const targetRuntimeSeconds=input.targetRuntimeSeconds??profile.runtime
  if(!Number.isFinite(targetRuntimeSeconds)||targetRuntimeSeconds<=0||targetRuntimeSeconds>14400){
    throw new Error('SIDE_HUSTLE_DIRECTOR_RUNTIME_INVALID')
  }
  const aspectRatio=input.aspectRatio??profile.aspectRatio
  const createdAt=input.createdAt??new Date().toISOString()
  if(Number.isNaN(Date.parse(createdAt)))throw new Error('SIDE_HUSTLE_DIRECTOR_CREATED_AT_INVALID')
  const sourceRefs=unique(input.sourceRefs)
  const rightsEvidenceRefs=unique(input.rightsEvidenceRefs)
  const evidenceRefs=unique([...input.evidenceRefs,...sourceRefs,...rightsEvidenceRefs])
  const archetypePlan=createDirectorArchetypePlan({
    id:`${input.id}:archetype`,
    projectId:input.directorProjectId,
    archetype:profile.archetype,
    sourceRefs,
    rightsEvidenceRefs,
    createdAt,
  })

  const activeTask=[
    `Create a ${targetRuntimeSeconds} second ${profile.label} in ${aspectRatio}.`,
    input.intent.trim(),
    `Business Factory source: ${input.sourceRef.trim()}.`,
    'Preserve supplied rights/provenance and return an editable Director project.',
    'Do not publish, buy media, or spend outside the separately governed production/provider authority.',
  ].join(' ')

  return Object.freeze({
    id:input.id.trim(),
    opportunityId:input.opportunityId.trim(),
    family,
    sourceRef:input.sourceRef.trim(),
    directorProjectId:input.directorProjectId.trim(),
    format:input.format,
    archetype:profile.archetype,
    archetypePlan,
    aspectRatio,
    targetRuntimeSeconds,
    activeTask,
    sourceRefs:Object.freeze(sourceRefs),
    rightsEvidenceRefs:Object.freeze(rightsEvidenceRefs),
    evidenceRefs:Object.freeze(evidenceRefs),
    productionQuality:profile.productionQuality,
    workstationHref:'/workstation?projectId='+encodeURIComponent(input.directorProjectId.trim())+
      '&durationSeconds='+encodeURIComponent(String(targetRuntimeSeconds))+
      '&aspectRatio='+encodeURIComponent(aspectRatio),
    authority:'PLANNING_ONLY',
    publicationAuthority:'NONE',
    paidMediaAuthority:'NONE',
  })
}

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}
