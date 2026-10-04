import {
  objectDetectionsToVisualEvidence,
  type ObjectDetectionPrediction,
} from './object-detection-observation.js'
import {ULTRALYTICS_YOLO26N_COCO} from './vision-model-profile.js'
import type {VisualAnnotationEvidence} from './visual-observation-evidence.js'
import type {ProviderVisualShape} from './visual-annotation-provider.js'

export type UltralyticsBoxLike=Readonly<{
  classId:number
  className?:string
  confidence:number
  x:number
  y:number
  width:number
  height:number
  trackId?:string|number
}>

export type UltralyticsFrameResultLike=Readonly<{
  frame:number
  imageWidth:number
  imageHeight:number
  boxes:readonly UltralyticsBoxLike[]
  names?:Readonly<Record<number,string>>
}>

function className(box:UltralyticsBoxLike,names?:Readonly<Record<number,string>>):string{
  const explicit=box.className?.trim()
  if(explicit)return explicit
  const mapped=names?.[box.classId]?.trim()
  if(mapped)return mapped
  return 'class:'+box.classId
}

function cleanTrackId(value:string|number|undefined):string|undefined{
  if(value===undefined)return undefined
  const text=String(value).trim()
  return text?text:undefined
}

function prediction(box:UltralyticsBoxLike,names?:Readonly<Record<number,string>>):ObjectDetectionPrediction{
  return Object.freeze({
    className:className(box,names),
    confidence:box.confidence,
    x:box.x,
    y:box.y,
    width:box.width,
    height:box.height,
    ...(cleanTrackId(box.trackId)?{trackId:'ultralytics:'+cleanTrackId(box.trackId)}:{}),
  })
}

export function ultralyticsFrameToVisualEvidence(input:{
  id:string
  projectId:string
  assetId:string
  observedAt:string
  fps:number
  result:UltralyticsFrameResultLike
  allowedClasses?:readonly string[]
  evidenceRefs:readonly string[]
  modelId?:string
}):VisualAnnotationEvidence{
  const modelId=input.modelId?.trim()||ULTRALYTICS_YOLO26N_COCO.modelId
  const predictions=input.result.boxes.map(box=>prediction(box,input.result.names))
  return objectDetectionsToVisualEvidence({
    id:input.id,
    projectId:input.projectId,
    assetId:input.assetId,
    provider:ULTRALYTICS_YOLO26N_COCO.provider,
    modelId,
    observedAt:input.observedAt,
    frame:input.result.frame,
    fps:input.fps,
    imageWidth:input.result.imageWidth,
    imageHeight:input.result.imageHeight,
    predictions,
    allowedClasses:input.allowedClasses,
    evidenceRefs:Object.freeze([
      ...input.evidenceRefs,
      'vision-provider:ultralytics',
      'vision-model:'+modelId,
    ]),
    limitations:[
      'Ultralytics output is automatic observation evidence only.',
      'Tracking IDs are provider-local and do not establish a real-world identity.',
      'Human/ground-truth review is required before training labels or protected-region corrections become accepted project truth.',
      'Use of Ultralytics must comply with its AGPL-3.0 terms or a separately obtained Ultralytics license.',
    ],
  })
}

export function ultralyticsFrameToProviderShapes(input:{
  providerTaskId:string
  result:UltralyticsFrameResultLike
  modelId?:string
}):readonly ProviderVisualShape[]{
  const modelId=input.modelId?.trim()||ULTRALYTICS_YOLO26N_COCO.modelId
  return Object.freeze(input.result.boxes.flatMap((box,index)=>{
    const label=className(box,input.result.names)
    if(
      !label.trim()||
      !Number.isFinite(box.confidence)||
      box.confidence<=0||
      box.confidence>1||
      !Number.isFinite(box.x)||
      !Number.isFinite(box.y)||
      !Number.isFinite(box.width)||
      !Number.isFinite(box.height)||
      box.width<=0||
      box.height<=0
    )return[]
    const left=box.x-box.width/2
    const top=box.y-box.height/2
    const right=box.x+box.width/2
    const bottom=box.y+box.height/2
    const trackId=cleanTrackId(box.trackId)
    const annotationId=[
      'ultralytics',
      input.providerTaskId,
      input.result.frame,
      trackId??String(index+1),
    ].join(':')
    return [Object.freeze({
      annotationId,
      label,
      kind:trackId?'track':'box',
      frameStart:input.result.frame,
      frameEnd:input.result.frame,
      confidence:box.confidence,
      points:Object.freeze([left,top,right,bottom]),
      ...(trackId?{trackId:'ultralytics:'+trackId}:{}),
      attributes:Object.freeze({
        modelId,
        classId:box.classId,
        automatic:true,
      }),
      evidenceRefs:Object.freeze([
        'ultralytics:model:'+modelId,
        'ultralytics:frame:'+input.result.frame,
        'ultralytics:annotation:'+annotationId,
      ]),
    })]
  }))
}
