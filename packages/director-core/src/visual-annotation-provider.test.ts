import {describe,expect,it} from 'vitest'
import {annotationImportToVisualEvidence,type VisualAnnotationImport} from './visual-annotation-provider.js'

describe('visual annotation provider evidence',()=>{
  it('converts reviewed-provider imports to candidate visual evidence without granting truth',()=>{
    const imported:VisualAnnotationImport={
      provider:'cvat',
      providerTaskId:'42',
      importedAt:'2026-10-04T22:00:00.000Z',
      sourceDigest:'abc123',
      shapes:[{
        annotationId:'shape-1',
        label:'face',
        kind:'box',
        frameStart:30,
        frameEnd:59,
        confidence:1,
        points:[100,100,300,300],
        evidenceRefs:['cvat:shape:1'],
      }],
      evidenceRefs:['cvat:task:42'],
      authority:'GROUND_TRUTH_CANDIDATE_ONLY',
      accepted:false,
    }
    const [evidence]=annotationImportToVisualEvidence({
      projectId:'project-1',
      assetId:'asset-1',
      taskId:'task-1',
      imported,
      timebase:{fps:30,durationSeconds:10,width:1000,height:500},
      labelKinds:{face:'face'},
    })
    expect(evidence).toBeDefined()
    expect(evidence?.evidenceRefs).toEqual(expect.arrayContaining([
      'cvat:task:42',
      'cvat:shape:1',
      'annotation-import-digest:abc123',
    ]))
    expect(evidence?.limitations.join(' ')).toContain('candidate evidence')
    expect(evidence?.protectedRegions[0]).toMatchObject({
      kind:'face',
      startSeconds:1,
      endSeconds:2,
    })
    expect(evidence?.protectedRegions[0]?.bounds.x).toBeCloseTo(0.1)
    expect(evidence?.protectedRegions[0]?.bounds.y).toBeCloseTo(0.2)
    expect(evidence?.protectedRegions[0]?.bounds.width).toBeCloseTo(0.2)
    expect(evidence?.protectedRegions[0]?.bounds.height).toBeCloseTo(0.4)
  })
})
