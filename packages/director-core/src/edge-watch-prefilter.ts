export type EdgeWatchPrefilterMode='disabled'|'motion'|'object-detection'|'hybrid'

export type EdgeWatchFrameSignal=Readonly<{
  frameIndex:number
  timestampSeconds:number
  motionScore?:number
  detectionCount?:number
  detectionClasses?:readonly string[]
  confidence?:number
}>

export type EdgeWatchPrefilterPolicy=Readonly<{
  mode:EdgeWatchPrefilterMode
  minimumMotionScore:number
  minimumDetectionConfidence:number
  interestingClasses:readonly string[]
  keepEverySeconds:number
  maximumEscalatedFrames:number
  preserveFirstLast:boolean
}>

export type EdgeWatchPrefilterDecision=Readonly<{
  selectedFrameIndices:readonly number[]
  droppedFrameIndices:readonly number[]
  reasonsByFrame:Readonly<Record<number,readonly string[]>>
  selectedRatio:number
  authority:'EDGE_PREFILTER_ONLY'
  canEstablishReality:false
  canPublish:false
  canWager:false
}>

function clamp01(value:number):number{
  if(!Number.isFinite(value))return 0
  return Math.max(0,Math.min(1,value))
}

export function validateEdgeWatchPrefilterPolicy(policy:EdgeWatchPrefilterPolicy):readonly string[]{
  const reasons:string[]=[]
  if(!['disabled','motion','object-detection','hybrid'].includes(policy.mode))reasons.push('DIRECTOR_EDGE_PREFILTER_MODE_INVALID')
  if(!Number.isFinite(policy.minimumMotionScore)||policy.minimumMotionScore<0||policy.minimumMotionScore>1){
    reasons.push('DIRECTOR_EDGE_PREFILTER_MOTION_THRESHOLD_INVALID')
  }
  if(!Number.isFinite(policy.minimumDetectionConfidence)||policy.minimumDetectionConfidence<0||policy.minimumDetectionConfidence>1){
    reasons.push('DIRECTOR_EDGE_PREFILTER_DETECTION_THRESHOLD_INVALID')
  }
  if(!Number.isFinite(policy.keepEverySeconds)||policy.keepEverySeconds<=0)reasons.push('DIRECTOR_EDGE_PREFILTER_KEEP_INTERVAL_INVALID')
  if(!Number.isInteger(policy.maximumEscalatedFrames)||policy.maximumEscalatedFrames<1){
    reasons.push('DIRECTOR_EDGE_PREFILTER_FRAME_CAP_INVALID')
  }
  return Object.freeze([...new Set(reasons)])
}

export function selectEdgeWatchFrames(input:{
  signals:readonly EdgeWatchFrameSignal[]
  policy:EdgeWatchPrefilterPolicy
}):EdgeWatchPrefilterDecision{
  const reasons=validateEdgeWatchPrefilterPolicy(input.policy)
  if(reasons.length)throw new Error('DIRECTOR_EDGE_PREFILTER_POLICY_INVALID:'+reasons.join(','))

  const signals=[...input.signals].sort((a,b)=>a.frameIndex-b.frameIndex)
  if(!signals.length){
    return Object.freeze({
      selectedFrameIndices:Object.freeze([]),
      droppedFrameIndices:Object.freeze([]),
      reasonsByFrame:Object.freeze({}),
      selectedRatio:0,
      authority:'EDGE_PREFILTER_ONLY',
      canEstablishReality:false,
      canPublish:false,
      canWager:false,
    })
  }

  const interestingClasses=new Set(input.policy.interestingClasses.map(value=>value.trim().toLowerCase()).filter(Boolean))
  const scored=signals.map((signal,index)=>{
    const frameReasons:string[]=[]
    let score=0
    if(input.policy.mode==='disabled'){
      frameReasons.push('PREFILTER_DISABLED')
      score=1
    }else{
      const motion=clamp01(signal.motionScore??0)
      const detectionConfidence=clamp01(signal.confidence??0)
      const classes=(signal.detectionClasses??[]).map(value=>value.trim().toLowerCase()).filter(Boolean)
      const classHit=classes.some(value=>interestingClasses.has(value))
      const detectionHit=(signal.detectionCount??0)>0&&
        detectionConfidence>=input.policy.minimumDetectionConfidence&&
        (!interestingClasses.size||classHit)
      const motionHit=motion>=input.policy.minimumMotionScore

      if((input.policy.mode==='motion'||input.policy.mode==='hybrid')&&motionHit){
        frameReasons.push('MOTION_THRESHOLD')
        score=Math.max(score,motion)
      }
      if((input.policy.mode==='object-detection'||input.policy.mode==='hybrid')&&detectionHit){
        frameReasons.push(classHit?'INTERESTING_CLASS':'OBJECT_DETECTION')
        score=Math.max(score,detectionConfidence)
      }
    }

    if(index===0&&input.policy.preserveFirstLast){
      frameReasons.push('PRESERVE_FIRST')
      score=Math.max(score,1)
    }
    if(index===signals.length-1&&input.policy.preserveFirstLast){
      frameReasons.push('PRESERVE_LAST')
      score=Math.max(score,1)
    }

    const previous=signals[index-1]
    if(!previous||signal.timestampSeconds-previous.timestampSeconds>=input.policy.keepEverySeconds){
      frameReasons.push('PERIODIC_BASELINE')
      score=Math.max(score,0.75)
    }

    return {signal,frameReasons,score}
  })

  // Ensure a true periodic baseline across sparse/irregular samples.
  let lastBaseline=-Infinity
  for(const item of scored){
    if(item.signal.timestampSeconds-lastBaseline>=input.policy.keepEverySeconds){
      if(!item.frameReasons.includes('PERIODIC_BASELINE'))item.frameReasons.push('PERIODIC_BASELINE')
      item.score=Math.max(item.score,0.75)
      lastBaseline=item.signal.timestampSeconds
    }
  }

  const ranked=scored
    .filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score||a.signal.frameIndex-b.signal.frameIndex)

  const selectedSet=new Set(
    ranked.slice(0,input.policy.maximumEscalatedFrames).map(item=>item.signal.frameIndex),
  )
  const selected=signals.filter(signal=>selectedSet.has(signal.frameIndex)).map(signal=>signal.frameIndex)
  const dropped=signals.filter(signal=>!selectedSet.has(signal.frameIndex)).map(signal=>signal.frameIndex)
  const reasonsByFrame=Object.fromEntries(
    scored.filter(item=>selectedSet.has(item.signal.frameIndex))
      .map(item=>[item.signal.frameIndex,Object.freeze([...item.frameReasons])]),
  )

  return Object.freeze({
    selectedFrameIndices:Object.freeze(selected),
    droppedFrameIndices:Object.freeze(dropped),
    reasonsByFrame:Object.freeze(reasonsByFrame),
    selectedRatio:selected.length/signals.length,
    authority:'EDGE_PREFILTER_ONLY',
    canEstablishReality:false,
    canPublish:false,
    canWager:false,
  })
}

export const DEFAULT_CREATIVE_EDGE_PREFILTER_POLICY:EdgeWatchPrefilterPolicy=Object.freeze({
  mode:'motion',
  minimumMotionScore:0.08,
  minimumDetectionConfidence:0.35,
  interestingClasses:Object.freeze([]),
  keepEverySeconds:30,
  maximumEscalatedFrames:48,
  preserveFirstLast:true,
})

export const DEFAULT_SPORTS_EDGE_PREFILTER_POLICY:EdgeWatchPrefilterPolicy=Object.freeze({
  mode:'hybrid',
  minimumMotionScore:0.05,
  minimumDetectionConfidence:0.3,
  interestingClasses:Object.freeze([
    'person','sports ball','baseball bat','baseball glove','tennis racket',
  ]),
  keepEverySeconds:10,
  maximumEscalatedFrames:90,
  preserveFirstLast:true,
})
