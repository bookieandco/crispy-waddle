import test from 'node:test'
import assert from 'node:assert/strict'
import {certifyRunpodShadowLive} from './shark-shadow-live-certification.js'

test('SHADOW-LIVE final stays pending until live horizon/storage/replay/sync gates are real',()=>{
  const report=certifyRunpodShadowLive({
    observedAt:'2026-10-04T17:00:00Z',
    snapshot:{
      observationCounts:{'15M':11},lessonCounts:{'15M':11},
      calibrationCount:1,memoryCount:2,pendingSync:44,
      latestCalibration:{performanceMims:{status:'REVIEW'},canAuthorizeLive:false,canMutateMandate:false},
      latestMemory:{canAuthorizeLive:false},
    },
    lastLive:{memoryApplied:2,canExecute:false,canSign:false,canBroadcast:false},
    lastOutcomes:{canExecute:false,canAuthorizeLive:false},
    service:{status:'ready',updatedAt:'2026-10-04T16:59:00Z'},
    networkVolumeAttached:false,
    swlcSyncReady:false,
  })
  assert.equal(report.passed,false)
  assert.equal(report.gates.first15mOutcome,true)
  assert.equal(report.gates.first1hGrading,false)
  assert.equal(report.gates.performanceMims,true)
  assert.equal(report.gates.memoryFeedback,true)
  assert.equal(report.gates.authorityBoundary,true)
})

test('SHADOW-LIVE final can pass without granting execution authority',()=>{
  const report=certifyRunpodShadowLive({
    observedAt:'2026-10-04T18:00:00Z',
    snapshot:{
      observationCounts:{'15M':20,'1H':20},lessonCounts:{'15M':20,'1H':20},
      calibrationCount:2,memoryCount:4,pendingSync:0,
      latestCalibration:{performanceMims:{status:'PASS'},canAuthorizeLive:false,canMutateMandate:false},
      latestMemory:{canAuthorizeLive:false},
    },
    lastLive:{memoryApplied:3,canExecute:false,canSign:false,canBroadcast:false},
    lastOutcomes:{canExecute:false,canAuthorizeLive:false},
    service:{status:'ready',updatedAt:'2026-10-04T17:58:00Z'},
    lastReplay:{replayId:'r1',canExecute:false,canAuthorizeLive:false},
    networkVolumeAttached:true,
    swlcSyncReady:true,
  })
  assert.equal(report.passed,true)
  assert.equal(report.canExecute,false)
  assert.equal(report.canAuthorizeLive,false)
})
