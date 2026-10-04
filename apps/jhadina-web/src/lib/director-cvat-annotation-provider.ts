import {createHash} from 'node:crypto'
import type {
  ProviderVisualShape,
  VisualAnnotationImport,
  VisualAnnotationProvider,
  VisualAnnotationProviderTask,
  VisualAnnotationProviderTaskRequest,
  VisualAnnotationKind,
} from '@jhadina/director-core'

type Json=Record<string,unknown>

type CvatConfig=Readonly<{
  baseUrl:string
  token:string
}>

function cleanBaseUrl(value:string):string{
  const parsed=new URL(value.trim())
  const localhost=['localhost','127.0.0.1','::1'].includes(parsed.hostname)
  if(parsed.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&localhost)){
    throw new Error('DIRECTOR_CVAT_HTTPS_REQUIRED')
  }
  if(parsed.username||parsed.password)throw new Error('DIRECTOR_CVAT_INLINE_CREDENTIALS_FORBIDDEN')
  parsed.hash=''
  parsed.search=''
  return parsed.toString().replace(/\/+$/,'')
}

export function resolveDirectorCvatConfig():CvatConfig|undefined{
  const base=process.env.JHADINA_CVAT_BASE_URL?.trim()??''
  const token=(
    process.env.JHADINA_CVAT_ACCESS_TOKEN?.trim()||
    process.env.JHADINA_CVAT_PAT?.trim()||
    ''
  )
  if(!base||!token)return undefined
  return Object.freeze({baseUrl:cleanBaseUrl(base),token})
}

async function jsonRequest<T>(
  config:CvatConfig,
  path:string,
  init:RequestInit={},
):Promise<T>{
  const response=await fetch(config.baseUrl+path,{
    ...init,
    headers:{
      accept:'application/json',
      authorization:'Bearer '+config.token,
      ...(init.body?{'content-type':'application/json'}:{}),
      ...(init.headers??{}),
    },
    cache:'no-store',
  })
  const text=await response.text()
  let body:unknown={}
  if(text){
    try{body=JSON.parse(text)}catch{body={detail:text.slice(0,500)}}
  }
  if(!response.ok){
    const detail=body&&typeof body==='object'&&'detail' in body?String((body as {detail?:unknown}).detail??''):''
    throw new Error('DIRECTOR_CVAT_HTTP_'+response.status+(detail?':'+detail:''))
  }
  return body as T
}

function cvatStatus(value:unknown):VisualAnnotationProviderTask['status']{
  const status=String(value??'').toLowerCase()
  if(status==='completed')return'completed'
  if(status==='validation')return'review-ready'
  if(status==='annotation')return'annotating'
  return'submitted'
}

function annotationKind(type:unknown):VisualAnnotationKind{
  switch(String(type??'').toLowerCase()){
    case'rectangle':
    case'cuboid':
      return'box'
    case'polygon':
    case'polyline':
    case'ellipse':
      return'polygon'
    case'points':
    case'skeleton':
      return'keypoints'
    case'mask':
      return'mask'
    default:
      return'tag'
  }
}

function pointArray(value:unknown,kind:VisualAnnotationKind):number[]{
  if(kind==='tag'||kind==='mask')return[]
  if(!Array.isArray(value))return[]
  return value.map(Number).filter(Number.isFinite)
}

function idString(value:unknown,fallback:string):string{
  const text=String(value??'').trim()
  return text||fallback
}

function labelsFrom(value:unknown):Map<number,string>{
  const rows=Array.isArray(value)
    ?value
    :value&&typeof value==='object'&&Array.isArray((value as {results?:unknown}).results)
      ?(value as {results:unknown[]}).results
      :[]
  const map=new Map<number,string>()
  for(const row of rows){
    if(!row||typeof row!=='object')continue
    const id=Number((row as {id?:unknown}).id)
    const name=String((row as {name?:unknown}).name??'').trim()
    if(Number.isInteger(id)&&name)map.set(id,name)
  }
  return map
}

function attributes(value:unknown):Record<string,string|number|boolean>{
  if(!Array.isArray(value))return{}
  const out:Record<string,string|number|boolean>={}
  for(const row of value){
    if(!row||typeof row!=='object')continue
    const specId=String((row as {spec_id?:unknown}).spec_id??'').trim()
    const raw=(row as {value?:unknown}).value
    if(!specId||!['string','number','boolean'].includes(typeof raw))continue
    out[specId]=raw as string|number|boolean
  }
  return out
}

function rawShapes(input:{
  providerTaskId:string
  annotations:Json
  labels:Map<number,string>
}):ProviderVisualShape[]{
  const output:ProviderVisualShape[]=[]
  const shapes=Array.isArray(input.annotations.shapes)?input.annotations.shapes:[]
  for(let index=0;index<shapes.length;index++){
    const row=shapes[index]
    if(!row||typeof row!=='object')continue
    const shape=row as Json
    const frame=Math.max(0,Math.round(Number(shape.frame??0)))
    const labelId=Number(shape.label_id)
    const kind=annotationKind(shape.type)
    const annotationId=idString(shape.id,'shape:'+index)
    output.push(Object.freeze({
      annotationId,
      label:input.labels.get(labelId)??'label:'+String(labelId),
      kind,
      frameStart:frame,
      frameEnd:frame,
      confidence:1,
      points:Object.freeze(pointArray(shape.points,kind)),
      attributes:Object.freeze(attributes(shape.attributes)),
      evidenceRefs:Object.freeze([
        'cvat:task:'+input.providerTaskId,
        'cvat:shape:'+annotationId,
        'cvat:frame:'+frame,
      ]),
    }))
  }

  const tracks=Array.isArray(input.annotations.tracks)?input.annotations.tracks:[]
  for(let trackIndex=0;trackIndex<tracks.length;trackIndex++){
    const row=tracks[trackIndex]
    if(!row||typeof row!=='object')continue
    const track=row as Json
    const trackId=idString(track.id,'track:'+trackIndex)
    const labelId=Number(track.label_id)
    const label=input.labels.get(labelId)??'label:'+String(labelId)
    const trackShapes=(Array.isArray(track.shapes)?track.shapes:[])
      .filter((shape):shape is Json=>Boolean(shape&&typeof shape==='object'))
      .sort((a,b)=>Number(a.frame??0)-Number(b.frame??0))

    for(let shapeIndex=0;shapeIndex<trackShapes.length;shapeIndex++){
      const shape=trackShapes[shapeIndex]!
      if(shape.outside===true)continue
      const frameStart=Math.max(0,Math.round(Number(shape.frame??0)))
      const next=trackShapes[shapeIndex+1]
      const frameEnd=next
        ?Math.max(frameStart,Math.round(Number(next.frame??frameStart))-1)
        :frameStart
      const annotationId=trackId+':'+shapeIndex
      const kind=annotationKind(shape.type)
      output.push(Object.freeze({
        annotationId,
        label,
        kind:'track',
        frameStart,
        frameEnd,
        confidence:1,
        points:Object.freeze(pointArray(shape.points,kind)),
        trackId,
        attributes:Object.freeze({...attributes(track.attributes),...attributes(shape.attributes)}),
        evidenceRefs:Object.freeze([
          'cvat:task:'+input.providerTaskId,
          'cvat:track:'+trackId,
          'cvat:track-shape:'+annotationId,
          'cvat:frames:'+frameStart+'-'+frameEnd,
        ]),
      }))
    }
  }

  const tags=Array.isArray(input.annotations.tags)?input.annotations.tags:[]
  for(let index=0;index<tags.length;index++){
    const row=tags[index]
    if(!row||typeof row!=='object')continue
    const tag=row as Json
    const frame=Math.max(0,Math.round(Number(tag.frame??0)))
    const labelId=Number(tag.label_id)
    const annotationId=idString(tag.id,'tag:'+index)
    output.push(Object.freeze({
      annotationId,
      label:input.labels.get(labelId)??'label:'+String(labelId),
      kind:'tag',
      frameStart:frame,
      frameEnd:frame,
      confidence:1,
      points:Object.freeze([]),
      attributes:Object.freeze(attributes(tag.attributes)),
      evidenceRefs:Object.freeze([
        'cvat:task:'+input.providerTaskId,
        'cvat:tag:'+annotationId,
        'cvat:frame:'+frame,
      ]),
    }))
  }
  return output
}

export class CvatVisualAnnotationProvider implements VisualAnnotationProvider{
  constructor(private readonly config:CvatConfig){}

  async createTask(request:VisualAnnotationProviderTaskRequest):Promise<VisualAnnotationProviderTask>{
    if(request.rightsVerified!==true||request.sourceAuthorized!==true){
      throw new Error('DIRECTOR_CVAT_SOURCE_AUTHORIZATION_REQUIRED')
    }
    const created=await jsonRequest<{id?:number;status?:string}>(
      this.config,
      '/api/tasks',
      {
        method:'POST',
        body:JSON.stringify({
          name:request.title,
          labels:request.labels.map(label=>({name:label.name,...(label.color?{color:label.color}:{})})),
        }),
      },
    )
    if(!Number.isInteger(created.id))throw new Error('DIRECTOR_CVAT_TASK_ID_REQUIRED')
    const providerTaskId=String(created.id)
    const upload=await jsonRequest<{rq_id?:string}>(
      this.config,
      '/api/tasks/'+providerTaskId+'/data',
      {
        method:'POST',
        body:JSON.stringify({
          remote_files:[request.sourceUri],
          image_quality:70,
          use_cache:true,
        }),
      },
    )
    const providerRequestId=String(upload.rq_id??'').trim()
    if(!providerRequestId)throw new Error('DIRECTOR_CVAT_DATA_REQUEST_ID_REQUIRED')
    return Object.freeze({
      taskId:request.taskId,
      provider:'cvat',
      providerTaskId,
      providerRequestId,
      status:cvatStatus(created.status),
      webUrl:this.config.baseUrl+'/tasks/'+providerTaskId,
      evidenceRefs:Object.freeze([
        ...request.evidenceRefs,
        'cvat:task:'+providerTaskId,
        'cvat:data-request:'+providerRequestId,
      ]),
      authority:'ANNOTATION_PROVIDER_ONLY',
      canEdit:false,
      canPublish:false,
      canEstablishSportsReality:false,
    })
  }

  async refreshTask(providerTaskId:string):Promise<VisualAnnotationProviderTask>{
    const task=await jsonRequest<{id?:number;status?:string}>(
      this.config,
      '/api/tasks/'+encodeURIComponent(providerTaskId),
    )
    return Object.freeze({
      taskId:'provider-task:cvat:'+providerTaskId,
      provider:'cvat',
      providerTaskId,
      status:cvatStatus(task.status),
      webUrl:this.config.baseUrl+'/tasks/'+providerTaskId,
      evidenceRefs:Object.freeze(['cvat:task:'+providerTaskId]),
      authority:'ANNOTATION_PROVIDER_ONLY',
      canEdit:false,
      canPublish:false,
      canEstablishSportsReality:false,
    })
  }

  async importAnnotations(providerTaskId:string):Promise<VisualAnnotationImport>{
    const [annotations,labels]=await Promise.all([
      jsonRequest<Json>(this.config,'/api/tasks/'+encodeURIComponent(providerTaskId)+'/annotations'),
      jsonRequest<unknown>(this.config,'/api/labels?task_id='+encodeURIComponent(providerTaskId)+'&page_size=1000'),
    ])
    const labelMap=labelsFrom(labels)
    const shapes=rawShapes({providerTaskId,annotations,labels:labelMap})
    const sourceDigest=createHash('sha256')
      .update(JSON.stringify({providerTaskId,annotations,labels:[...labelMap.entries()]}))
      .digest('hex')
    return Object.freeze({
      provider:'cvat',
      providerTaskId,
      importedAt:new Date().toISOString(),
      sourceDigest,
      shapes:Object.freeze(shapes),
      evidenceRefs:Object.freeze([
        'cvat:task:'+providerTaskId,
        'cvat:annotation-digest:'+sourceDigest,
      ]),
      authority:'GROUND_TRUTH_CANDIDATE_ONLY',
      accepted:false,
    })
  }
}

export function createConfiguredCvatVisualAnnotationProvider():CvatVisualAnnotationProvider|undefined{
  const config=resolveDirectorCvatConfig()
  return config?new CvatVisualAnnotationProvider(config):undefined
}
