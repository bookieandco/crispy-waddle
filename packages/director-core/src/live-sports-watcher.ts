import {
  createDirectorSportsWatchEnvelope,
  type DirectorSportsObservationKind,
  type DirectorSportsWatchEnvelope,
} from './live-sports-watch'

export type DirectorLiveSportsFrame=Readonly<{
  eventId:string
  frameId:string
  subjectId:string
  capturedAt:string
  availableAt:string
  sourceLocator:string
  mediaRef:string
  evidenceIds:readonly string[]
  rightsVerified:boolean
  sourceAuthorized:boolean
}>

export type DirectorSportsVisionDetection=Readonly<{
  kind:DirectorSportsObservationKind
  value:string|number|boolean
  confidence:number
  evidenceIds:readonly string[]
}>

export interface DirectorSportsVisionProvider{
  readonly providerId:string
  analyzeFrame(frame:DirectorLiveSportsFrame):Promise<readonly DirectorSportsVisionDetection[]>
}

const nonEmpty=(value:string,code:string):void=>{if(!value.trim())throw new Error(code)}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export class DirectorLiveSportsWatcher{
  constructor(private readonly provider:DirectorSportsVisionProvider){
    nonEmpty(provider.providerId,'DIRECTOR_SPORTS_PROVIDER_ID_REQUIRED')
  }

  async observeFrame(frame:DirectorLiveSportsFrame):Promise<readonly DirectorSportsWatchEnvelope[]>{
    nonEmpty(frame.eventId,'DIRECTOR_SPORTS_FRAME_EVENT_REQUIRED')
    nonEmpty(frame.frameId,'DIRECTOR_SPORTS_FRAME_ID_REQUIRED')
    nonEmpty(frame.subjectId,'DIRECTOR_SPORTS_FRAME_SUBJECT_REQUIRED')
    nonEmpty(frame.sourceLocator,'DIRECTOR_SPORTS_FRAME_SOURCE_REQUIRED')
    nonEmpty(frame.mediaRef,'DIRECTOR_SPORTS_FRAME_MEDIA_REQUIRED')
    if(frame.rightsVerified!==true)throw new Error('DIRECTOR_SPORTS_RIGHTS_NOT_VERIFIED')
    if(frame.sourceAuthorized!==true)throw new Error('DIRECTOR_SPORTS_SOURCE_NOT_AUTHORIZED')
    const captured=Date.parse(frame.capturedAt),available=Date.parse(frame.availableAt)
    if(Number.isNaN(captured)||Number.isNaN(available)||available<captured)throw new Error('DIRECTOR_SPORTS_FRAME_TIME_INVALID')
    const frameEvidence=unique(frame.evidenceIds)
    if(!frameEvidence.length)throw new Error('DIRECTOR_SPORTS_FRAME_EVIDENCE_REQUIRED')

    const detections=await this.provider.analyzeFrame(Object.freeze({...frame,evidenceIds:frameEvidence}))
    const envelopes:DirectorSportsWatchEnvelope[]=[]
    for(let index=0;index<detections.length;index++){
      const detection=detections[index]!
      const evidenceIds=unique([...frameEvidence,...detection.evidenceIds,'vision-provider:'+this.provider.providerId])
      envelopes.push(createDirectorSportsWatchEnvelope({
        observationId:'director-sports:'+frame.eventId+':'+frame.frameId+':'+index+':'+detection.kind,
        eventId:frame.eventId,
        subjectId:frame.subjectId,
        frameId:frame.frameId,
        kind:detection.kind,
        value:detection.value,
        confidence:detection.confidence,
        observedAt:frame.capturedAt,
        availableAt:frame.availableAt,
        sourceLocator:frame.sourceLocator,
        evidenceIds,
        rightsVerified:true,
        sourceAuthorized:true,
      }))
    }
    return Object.freeze(envelopes)
  }
}