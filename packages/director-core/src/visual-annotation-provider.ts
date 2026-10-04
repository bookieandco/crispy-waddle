import type {
  MediaTimebase,
  ProtectedVisualRegionKind,
  VisualAnnotationEvidence,
  VisualAnnotationKind,
  VisualRegion,
} from './visual-observation-evidence.js'

export type VisualAnnotationScope='director'|'sports'|'watch'

export type VisualAnnotationProviderLabel=Readonly<{
  name:string
  protectedRegionKind?:ProtectedVisualRegionKind
  color?:string
}>

export type VisualAnnotationProviderTaskRequest=Readonly<{
  taskId:string
  scope:VisualAnnotationScope
  projectId?:string
  eventId?:string
  assetId?:string
  sourceUri:string
  title:string
  timebase:MediaTimebase
  labels:readonly VisualAnnotationProviderLabel[]
  rightsVerified:true
  sourceAuthorized:true
  evidenceRefs:readonly string[]
}>

export type VisualAnnotationProviderTask=Readonly<{
  taskId:string
  provider:string
  providerTaskId:string
  providerRequestId?:string
  status:'submitted'|'annotating'|'review-ready'|'completed'|'failed'
  webUrl?:string
  evidenceRefs:readonly string[]
  authority:'ANNOTATION_PROVIDER_ONLY'
  canEdit:false
  canPublish:false
  canEstablishSportsReality:false
}>

export type ProviderVisualShape=Readonly<{
  annotationId:string
  label:string
  kind:VisualAnnotationKind
  frameStart:number
  frameEnd:number
  confidence:number
  points:readonly number[]
  trackId?:string
  attributes?:Readonly<Record<string,string|number|boolean>>
  evidenceRefs:readonly string[]
}>

export type VisualAnnotationImport=Readonly<{
  provider:string
  providerTaskId:string
  importedAt:string
  sourceDigest:string
  shapes:readonly ProviderVisualShape[]
  evidenceRefs:readonly string[]
  authority:'GROUND_TRUTH_CANDIDATE_ONLY'
  accepted:false
}>

export interface VisualAnnotationProvider{
  createTask(request:VisualAnnotationProviderTaskRequest):Promise<VisualAnnotationProviderTask>
  refreshTask(providerTaskId:string):Promise<VisualAnnotationProviderTask>
  importAnnotations(providerTaskId:string):Promise<VisualAnnotationImport>
}

function clean(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))]
}

function bbox(points:readonly number[]):{x1:number;y1:number;x2:number;y2:number}|undefined{
  if(points.length<4||points.some(value=>!Number.isFinite(value)))return undefined
  const xs:number[]=[]
  const ys:number[]=[]
  for(let i=0;i+1<points.length;i+=2){
    xs.push(points[i]!)
    ys.push(points[i+1]!)
  }
  if(!xs.length||!ys.length)return undefined
  const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys)
  if(x2<=x1||y2<=y1)return undefined
  return {x1,y1,x2,y2}
}

function normalizedRegion(input:{
  id:string
  kind:ProtectedVisualRegionKind
  shape:ProviderVisualShape
  timebase:MediaTimebase
}):VisualRegion|undefined{
  const bounds=bbox(input.shape.points)
  if(!bounds)return undefined
  const {width,height,fps,durationSeconds}=input.timebase
  if(width<=0||height<=0||fps<=0||durationSeconds<=0)return undefined
  const x=Math.max(0,Math.min(1,bounds.x1/width))
  const y=Math.max(0,Math.min(1,bounds.y1/height))
  const right=Math.max(0,Math.min(1,bounds.x2/width))
  const bottom=Math.max(0,Math.min(1,bounds.y2/height))
  if(right<=x||bottom<=y)return undefined
  const startSeconds=Math.max(0,input.shape.frameStart/fps)
  const endSeconds=Math.min(durationSeconds,Math.max(startSeconds+1/fps,(input.shape.frameEnd+1)/fps))
  return Object.freeze({
    id:input.id,
    kind:input.kind,
    startSeconds,
    endSeconds,
    bounds:Object.freeze({x,y,width:right-x,height:bottom-y}),
    confidence:input.shape.confidence,
    ...(input.shape.trackId?{trackId:input.shape.trackId}:{}),
  })
}

export function annotationImportToVisualEvidence(input:{
  projectId:string
  assetId:string
  taskId:string
  imported:VisualAnnotationImport
  timebase:MediaTimebase
  labelKinds:Readonly<Record<string,ProtectedVisualRegionKind|undefined>>
}):readonly VisualAnnotationEvidence[]{
  const output:VisualAnnotationEvidence[]=[]
  for(const shape of input.imported.shapes){
    const protectedKind=input.labelKinds[shape.label.toLowerCase()]
    const region=protectedKind?normalizedRegion({
      id:'region:'+input.taskId+':'+shape.annotationId,
      kind:protectedKind,
      shape,
      timebase:input.timebase,
    }):undefined
    output.push(Object.freeze({
      id:'visual-evidence:'+input.taskId+':'+shape.annotationId,
      projectId:input.projectId,
      assetId:input.assetId,
      annotationKind:shape.kind,
      observedAt:input.imported.importedAt,
      provider:input.imported.provider,
      frameStart:shape.frameStart,
      frameEnd:shape.frameEnd,
      confidence:shape.confidence,
      evidenceRefs:Object.freeze(clean([
        ...input.imported.evidenceRefs,
        ...shape.evidenceRefs,
        'annotation-task:'+input.taskId,
        'annotation-provider-task:'+input.imported.providerTaskId,
        'annotation-import-digest:'+input.imported.sourceDigest,
      ])),
      limitations:Object.freeze([
        'Provider annotations remain candidate evidence until explicitly accepted into Jhadina project truth.',
        ...(region?[]:['No protected-region semantic mapping was configured for this label.']),
      ]),
      protectedRegions:Object.freeze(region?[region]:[]),
    }))
  }
  return Object.freeze(output)
}
