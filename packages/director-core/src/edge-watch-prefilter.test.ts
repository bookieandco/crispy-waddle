import {describe,expect,it} from 'vitest'
import {
  DEFAULT_SPORTS_EDGE_PREFILTER_POLICY,
  selectEdgeWatchFrames,
  validateEdgeWatchPrefilterPolicy,
  type EdgeWatchPrefilterPolicy,
} from './edge-watch-prefilter.js'

describe('edge Watch prefilter',()=>{
  it('fails invalid threshold/cap policies before selecting frames',()=>{
    const invalid:EdgeWatchPrefilterPolicy={
      mode:'hybrid',
      minimumMotionScore:-1,
      minimumDetectionConfidence:2,
      interestingClasses:[],
      keepEverySeconds:0,
      maximumEscalatedFrames:0,
      preserveFirstLast:true,
    }
    expect(validateEdgeWatchPrefilterPolicy(invalid)).toEqual(expect.arrayContaining([
      'DIRECTOR_EDGE_PREFILTER_MOTION_THRESHOLD_INVALID',
      'DIRECTOR_EDGE_PREFILTER_DETECTION_THRESHOLD_INVALID',
      'DIRECTOR_EDGE_PREFILTER_KEEP_INTERVAL_INVALID',
      'DIRECTOR_EDGE_PREFILTER_FRAME_CAP_INVALID',
    ]))
    expect(()=>selectEdgeWatchFrames({signals:[],policy:invalid})).toThrow('DIRECTOR_EDGE_PREFILTER_POLICY_INVALID')
  })

  it('escalates interesting sports objects within a bounded VLM frame budget',()=>{
    const policy:EdgeWatchPrefilterPolicy={
      ...DEFAULT_SPORTS_EDGE_PREFILTER_POLICY,
      keepEverySeconds:999,
      maximumEscalatedFrames:2,
      preserveFirstLast:false,
    }
    const result=selectEdgeWatchFrames({
      policy,
      signals:[
        {frameIndex:1,timestampSeconds:0,motionScore:0.01},
        {frameIndex:2,timestampSeconds:2,motionScore:0.01,detectionCount:1,detectionClasses:['sports ball'],confidence:0.92},
        {frameIndex:3,timestampSeconds:4,motionScore:0.7},
        {frameIndex:4,timestampSeconds:6,motionScore:0.01,detectionCount:1,detectionClasses:['chair'],confidence:0.99},
      ],
    })
    expect(result.selectedFrameIndices).toEqual([1,2])
    expect(result.droppedFrameIndices).toEqual([3,4])
    expect(result.reasonsByFrame[2]).toContain('INTERESTING_CLASS')
    expect(result.selectedRatio).toBe(0.5)
    expect(result.authority).toBe('EDGE_PREFILTER_ONLY')
    expect(result.canEstablishReality).toBe(false)
    expect(result.canPublish).toBe(false)
    expect(result.canWager).toBe(false)
  })

  it('returns an empty observation-only decision for an empty source',()=>{
    const result=selectEdgeWatchFrames({
      signals:[],
      policy:DEFAULT_SPORTS_EDGE_PREFILTER_POLICY,
    })
    expect(result.selectedFrameIndices).toEqual([])
    expect(result.selectedRatio).toBe(0)
    expect(result.canEstablishReality).toBe(false)
  })
})
