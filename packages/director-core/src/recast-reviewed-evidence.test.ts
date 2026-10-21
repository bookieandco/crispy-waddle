import { describe, expect, it } from 'vitest'
import { evaluateRecastReviewedEvidence, planReviewedRecastPreview,
  type RecastCandidateSelection, type RecastReviewedEvidence } from './recast-reviewed-evidence'
import { createRecastPreviewWorkerHandoff, evaluateRecastPreviewQC } from './recast-preview-worker-handoff'

const hash = (char: string) => char.repeat(64)
const selection: RecastCandidateSelection = {
  projectId: 'project:1', ownerUserId: 'owner:1',
  sourceVideoAssetId: 'video:1', characterImageAssetId: 'image:1', sourceAudioAssetId: 'audio:1',
}
const evidence: RecastReviewedEvidence = {
  media: {
    projectId: selection.projectId, ownerUserId: selection.ownerUserId, verified: true,
    sourceVideoAssetId: selection.sourceVideoAssetId, sourceVideoSha256: hash('a'),
    characterImageAssetId: selection.characterImageAssetId, characterImageSha256: hash('b'),
    sourceAudioAssetId: selection.sourceAudioAssetId, sourceAudioSha256: hash('c'),
    decodedDurationSeconds: 12,
  },
  tracking: {
    projectId: selection.projectId, sourceVideoAssetId: selection.sourceVideoAssetId,
    sourceVideoSha256: hash('a'), trackingArtifactId: 'tracking:1',
    reviewReceiptId: 'review:tracking:1', reviewedByUserId: 'reviewer:1', approved: true,
    tracks: [{
      trackId: 'track:1', class: 'character', instanceId: 'actor:1',
      frameStart: 0, frameEnd: 50, annotations: [], source: 'human',
      confidence: .99, approved: true,
    }],
  },
  voice: {
    projectId: selection.projectId, sourceVideoAssetId: selection.sourceVideoAssetId,
    sourceAudioAssetId: selection.sourceAudioAssetId, sourceAudioSha256: hash('c'),
    reviewerUserId: 'reviewer:1', reviewReceiptId: 'review:voice:1',
    evidenceIds: ['voice:timing:1'], approved: true,
    tracks: [{ startMs: 0, endMs: 2000, confidence: .98 }],
  },
  rights: {
    projectId: selection.projectId, ownerUserId: selection.ownerUserId,
    sourceVideoAssetId: selection.sourceVideoAssetId,
    characterImageAssetId: selection.characterImageAssetId,
    sourceAudioAssetId: selection.sourceAudioAssetId,
    consentReceiptId: 'consent:1', rightsReceiptId: 'rights:1',
    reviewedByUserId: 'reviewer:1', approved: true,
  },
}
const plan=()=>planReviewedRecastPreview('request:1','2026-10-21T15:00:00Z',selection,evidence)

describe('Recast reviewed evidence and disabled preview worker', () => {
  it('binds coherent evidence to existing motion-preserving planner without execution authority', () => {
    expect(evaluateRecastReviewedEvidence(selection,evidence).planningAdmissible).toBe(true)
    const p=plan()
    expect(p.source.stages).toEqual(['character-replace','voice-sync','qc','asset-approval'])
    expect(p.executionAuthority).toBe('NONE')
    const handoff=createRecastPreviewWorkerHandoff(p)
    expect(handoff).toMatchObject({
      workerConnection:'DISABLED',executionPermit:null,
      costAuthority:'NONE',publicationAuthority:'NONE',
      sourceAudioAssetId:'audio:1',sourceVideoAssetId:'video:1',
      outputPolicy:'UNAPPROVED_PREVIEW_ONLY',
    })
    expect(handoff.stages).toEqual(['tracking-review','character-replace','voice-sync','render-preview','independent-qc','owner-review'])
  })
  it('fails if evidence is cross-project or track lineage is modified', () => {
    expect(evaluateRecastReviewedEvidence({...selection,projectId:'other'},evidence).planningAdmissible).toBe(false)
    expect(() => planReviewedRecastPreview('req','now',selection,{
      ...evidence,tracking:{...evidence.tracking!,sourceVideoSha256:hash('d')},
    })).toThrow(/APPROVED_TRACKING_LINEAGE_REQUIRED/)
    expect(evaluateRecastReviewedEvidence(selection,{
      ...evidence,tracking:{...evidence.tracking!,tracks:[{...evidence.tracking!.tracks[0],source:'model'}]},
    }).planningAdmissible).toBe(false)
  })
  it('requires real independently reviewed voice timing and verified rights/consent', () => {
    expect(evaluateRecastReviewedEvidence(selection,{
      ...evidence,voice:{...evidence.voice!,tracks:[{startMs:0,endMs:80000,confidence:.99}]},
    }).blockers).toContain('DIRECTOR_RECAST_REVIEWED_VOICE_LINEAGE_REQUIRED')
    expect(evaluateRecastReviewedEvidence(selection,{
      ...evidence,rights:{...evidence.rights!,consentReceiptId:''},
    }).blockers).toContain('DIRECTOR_RECAST_REVIEWED_CONSENT_AND_RIGHTS_REQUIRED')
    expect(evaluateRecastReviewedEvidence(selection,{...evidence,media:null}).planningAdmissible).toBe(false)
  })
  it('QC measures identity/motion/scene/lip-sync but never self-approves', () => {
    const h=createRecastPreviewWorkerHandoff(plan())
    const good = {
      previewAssetId:'preview:2',sourceVideoAssetId:'video:1',
      replacementCharacterAssetId:'image:1',sourceAudioAssetId:'audio:1',
      independentReviewerId:'reviewer:quality',workerProviderId:'worker:isolated',
      outputSha256:hash('e'),reviewedAt:'2026-10-21T15:10:00Z',
      measured:true,evidenceIds:['inspection:qa:1'],
      metrics:{
        visualIdentity:.91,motionMatch:.94,environmentMatch:.96,edgeQuality:.9,
        lightingMatch:.89,voiceSync:.88,absoluteAudioOffsetMs:32,
      },
    }
    const result=evaluateRecastPreviewQC(h,good)
    expect(result).toMatchObject({qualityPassed:true,approvedForTimeline:false,publicationAuthority:'NONE'})
    expect(evaluateRecastPreviewQC(h,{...good,independentReviewerId:'worker:isolated'}).qualityPassed).toBe(false)
    expect(evaluateRecastPreviewQC(h,{...good,metrics:{...good.metrics,absoluteAudioOffsetMs:90}}).qualityPassed).toBe(false)
    expect(evaluateRecastPreviewQC(h,{...good,sourceVideoAssetId:'video:other'}).qualityPassed).toBe(false)
    expect(evaluateRecastPreviewQC(h,{...good,metrics:{...good.metrics,motionMatch:NaN}}).qualityPassed).toBe(false)
  })
})
