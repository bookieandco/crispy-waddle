import {describe,expect,it} from 'vitest'
import {
  ultralyticsFrameToProviderShapes,
  ultralyticsFrameToVisualEvidence,
} from './ultralytics-observation.js'

describe('Ultralytics observation adapter',()=>{
  const result={
    frame:12,
    imageWidth:1920,
    imageHeight:1080,
    names:{0:'person',32:'sports ball'},
    boxes:[
      {classId:0,confidence:0.93,x:500,y:400,width:200,height:300,trackId:7},
      {classId:32,confidence:0.88,x:900,y:500,width:40,height:40},
      {classId:0,confidence:0.8,x:100,y:100,width:0,height:20},
    ],
  } as const

  it('normalizes valid boxes and preserves only provider-local track identity',()=>{
    const shapes=ultralyticsFrameToProviderShapes({providerTaskId:'watch-1',result})
    expect(shapes).toHaveLength(2)
    expect(shapes[0]).toMatchObject({
      label:'person',
      kind:'track',
      trackId:'ultralytics:7',
      frameStart:12,
      frameEnd:12,
      confidence:0.93,
    })
    expect(shapes[0]?.points).toEqual([400,250,600,550])
    expect(shapes[1]).toMatchObject({label:'sports ball',kind:'box'})
    expect(shapes.some(shape=>shape.points.length===0)).toBe(false)
  })

  it('marks model output as automatic observation evidence with licensing limitations',()=>{
    const evidence=ultralyticsFrameToVisualEvidence({
      id:'obs-1',
      projectId:'project-1',
      assetId:'asset-1',
      observedAt:'2026-10-04T22:00:00.000Z',
      fps:30,
      result,
      allowedClasses:['person','sports ball'],
      evidenceRefs:['frame-digest:abc'],
    })
    expect(evidence.evidenceRefs).toEqual(expect.arrayContaining([
      'frame-digest:abc',
      'vision-provider:ultralytics',
    ]))
    expect(evidence.limitations.join(' ')).toContain('do not establish a real-world identity')
    expect(evidence.limitations.join(' ')).toContain('AGPL-3.0')
  })
})
