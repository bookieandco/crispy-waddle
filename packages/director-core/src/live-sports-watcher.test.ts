import {describe,expect,it,vi} from 'vitest'
import {DirectorLiveSportsWatcher,type DirectorSportsVisionProvider} from './live-sports-watcher'

const frame=()=>({
  eventId:'nba:g1',
  frameId:'frame:100',
  subjectId:'team:home',
  capturedAt:'2026-09-29T03:00:00.000Z',
  availableAt:'2026-09-29T03:00:00.250Z',
  sourceLocator:'licensed-feed://nba/g1',
  mediaRef:'frame://sha256/abc',
  evidenceIds:['frame:sha256:abc'],
  rightsVerified:true,
  sourceAuthorized:true,
})

describe('Director live sports watcher service',()=>{
  it('calls an injected vision provider and emits inference-only observations',async()=>{
    const analyzeFrame=vi.fn(async()=>[
      {kind:'TEMPO' as const,value:.8,confidence:.9,evidenceIds:['vision:tempo']},
      {kind:'SCORE_CANDIDATE' as const,value:'80-79',confidence:.95,evidenceIds:['vision:score']},
    ])
    const provider:DirectorSportsVisionProvider={providerId:'vision-test',analyzeFrame}
    const watcher=new DirectorLiveSportsWatcher(provider)
    const observations=await watcher.observeFrame(frame())
    expect(analyzeFrame).toHaveBeenCalledTimes(1)
    expect(observations).toHaveLength(2)
    expect(observations.every(x=>x.canAuthorizeBet===false&&x.canExecute===false)).toBe(true)
    expect(observations[1]!.requiresOfficialReconciliation).toBe(true)
  })

  it('blocks unlicensed frames before provider IO',async()=>{
    const analyzeFrame=vi.fn(async()=>[])
    const watcher=new DirectorLiveSportsWatcher({providerId:'vision-test',analyzeFrame})
    await expect(watcher.observeFrame({...frame(),rightsVerified:false})).rejects.toThrow('DIRECTOR_SPORTS_RIGHTS_NOT_VERIFIED')
    expect(analyzeFrame).not.toHaveBeenCalled()
  })
})