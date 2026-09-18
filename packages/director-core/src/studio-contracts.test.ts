import { describe, expect, it } from "vitest"
import { advanceReplacementStage, createVideoReplacementJob, isVoiceSyncTrackUsable, mergeCharacterDNA, validateTrack, type CharacterBehaviorDNA } from "./studio-contracts"

describe("Director Studio contracts", () => {
  it("requires review for every replacement job", () => {
    const job=createVideoReplacementJob({id:"job-1",sourceAssetId:"source",replacementAssetId:"muppet",targetLabel:"character"})
    expect(job.requiresReview).toBe(true)
    expect(job.stage).toBe("detect")
  })
  it("advances replacement work through the deterministic pipeline", () => {
    const job=createVideoReplacementJob({id:"job-1",sourceAssetId:"source",replacementAssetId:"replacement",targetLabel:"character"})
    expect(advanceReplacementStage(job).stage).toBe("segment")
  })
  it("flags unusable tracking evidence", () => {
    expect(validateTrack({trackId:"t",class:"character",instanceId:"c",frameStart:10,frameEnd:1,annotations:[],source:"model",confidence:.2,approved:false})).toHaveLength(3)
  })
  it("accepts only sufficiently confident positive-duration voice sync tracks", () => {
    expect(isVoiceSyncTrackUsable({startMs:0,endMs:100,confidence:.8})).toBe(true)
    expect(isVoiceSyncTrackUsable({startMs:0,endMs:100,confidence:.6})).toBe(false)
  })
  it("merges DNA without hidden time or I/O", () => {
    const base: CharacterBehaviorDNA={characterId:"c",archetype:"puppet",traits:[],breathing:{enabled:true,ratePerMinute:10,variability:.1},movement:{gait:"bounce",pace:1,idleVariation:.2},speech:{cadence:1,pauseVariation:.2,overlapTolerance:.1},social:{eyeContact:.5,personalSpace:.5,gestureFrequency:.5,reactionDelayMs:300},continuity:{preserveAcrossScenes:true,lastUpdatedAt:"old"}}
    expect(mergeCharacterDNA(base,{movement:{...base.movement,pace:2}},"new").movement.pace).toBe(2)
    expect(mergeCharacterDNA(base,{},"new").continuity.lastUpdatedAt).toBe("new")
  })
})
