import { describe, expect, it } from 'vitest';
import type {
  DirectorHumanMediaEngine,
  DirectorHumanMediaExecutionReceipt,
  DirectorHumanMediaTaskKind,
} from './human-media-worker-contract.js';
import {
  DIRECTOR_HUMAN_MEDIA_QC_POLICIES,
  directedTakeObservationsToHumanMediaQc,
  evaluateDirectorHumanMediaQc,
  humanMediaQcToTakeCandidate,
  humanMediaWatchEvidenceToQc,
  type DirectorHumanMediaQcMetric,
  type DirectorHumanMediaQcObservation,
} from './human-media-qc.js';

const sha=(char:string)=>char.repeat(64);

function receipt(
  engine:DirectorHumanMediaEngine,
  task:DirectorHumanMediaTaskKind,
):DirectorHumanMediaExecutionReceipt{
  return {
    schema:'director.human-media-execution.v1',
    jobId:'job:1',
    providerJobId:'provider-job:1',
    engine,
    task,
    status:'ready',
    runtimeInstanceId:'runtime:1',
    imageDigest:`sha256:${sha('a')}`,
    sourceRevision:'source-rev',
    modelArtifactSha256s:[`sha256:${sha('b')}`],
    startedAt:'2026-10-07T00:00:00.000Z',
    completedAt:'2026-10-07T00:00:04.000Z',
    output:{uri:'file:///data/output.mp4',mediaType:engine==='coqui-tts'?'audio':'video',sha256:sha('c')},
    qualityClaim:false,
    authority:'DIRECTOR_HUMAN_MEDIA_EXECUTION_RECEIPT',
  };
}

function observations(
  engine:DirectorHumanMediaEngine,
  task:DirectorHumanMediaTaskKind,
  overrides:Partial<Record<DirectorHumanMediaQcMetric,Partial<DirectorHumanMediaQcObservation>>>={},
):DirectorHumanMediaQcObservation[]{
  const policy=DIRECTOR_HUMAN_MEDIA_QC_POLICIES.find(item=>item.engine===engine&&item.task===task);
  if(!policy)throw new Error('policy missing in test');
  return policy.requiredMetrics.map(metric=>({
    metric,
    score:Math.max(.96,policy.minimumScoreByMetric[metric]??0),
    confidence:.95,
    evidenceIds:[`evidence:${metric}`],
    source:metric==='lip-sync'?'sync-qc':metric==='speaker-similarity'?'speaker-qc':'human-review',
    ...overrides[metric],
  }));
}

function input(
  engine:DirectorHumanMediaEngine,
  task:DirectorHumanMediaTaskKind,
  obs:readonly DirectorHumanMediaQcObservation[],
  attempt=1,
  fallbackAllowed=false,
){
  return {
    projectId:'project:1',
    jobId:'job:1',
    outputAssetId:'asset:output',
    outputSha256:sha('c'),
    executionReceipt:receipt(engine,task),
    observations:obs,
    attempt,
    fallbackAllowed,
    evidenceIds:['watch-session:1','runtime-receipt:1'],
  } as const;
}

describe('Director human-media QC',()=>{
  it('accepts a fully evidenced MuseTalk take without trusting the execution worker',()=>{
    const decision=evaluateDirectorHumanMediaQc(input(
      'musetalk',
      'lip-sync',
      observations('musetalk','lip-sync'),
    ));
    expect(decision.admissible).toBe(true);
    expect(decision.action).toBe('accept');
    expect(decision.policyId).toBe('human-media:musetalk-lipsync:v1');
    expect(decision.authority).toBe('DIRECTOR_HUMAN_MEDIA_QC');
    expect(decision.evidenceIds).toContain('human-media-execution:provider-job:1');
  });

  it('reobserves rather than rerolling when independent lip-sync evidence is missing',()=>{
    const obs=observations('musetalk','lip-sync').filter(item=>item.metric!=='lip-sync');
    const decision=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs));
    expect(decision.admissible).toBe(false);
    expect(decision.action).toBe('reobserve');
    expect(decision.reasons).toContain('DIRECTOR_HUMAN_MEDIA_QC_MISSING:lip-sync');
    expect(decision.rerollReasons).toContain('quality-evidence-missing');
  });

  it('proposes localized repair for a bounded lip-sync defect',()=>{
    const obs=observations('musetalk','lip-sync',{
      'lip-sync':{
        score:.62,
        startSeconds:2.1,
        endSeconds:3.4,
        evidenceIds:['sync-qc:segment:2.1-3.4'],
      },
    });
    const decision=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs));
    expect(decision.action).toBe('localized-repair');
    expect(decision.rerollReasons).toContain('lip-sync-drift');
    expect(decision.repairRange).toEqual({startSeconds:2.1,endSeconds:3.4});
    expect(decision.preserve).toContain('actor-identity');
    expect(decision.preserve).not.toContain('approved-audio');
  });

  it('rerolls the same engine for genuine non-localized identity drift while budget remains',()=>{
    const obs=observations('musetalk','lip-sync',{
      'identity-stability':{
        score:.55,
        hardFailure:true,
        evidenceIds:['identity-qc:drift'],
        source:'identity-qc',
      },
    });
    const decision=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs,1,true));
    expect(decision.action).toBe('reroll-same-engine');
    expect(decision.rerollReasons).toContain('identity-drift');
    expect(decision.reasons).toContain('DIRECTOR_HUMAN_MEDIA_QC_HARD_FAILURE:identity-stability');
  });

  it('allows SadTalker fallback only after MuseTalk same-engine attempts are exhausted',()=>{
    const obs=observations('musetalk','lip-sync',{
      'face-stability':{score:.41,evidenceIds:['watch:face-artifact']},
    });
    const exhausted=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs,2,true));
    expect(exhausted.action).toBe('fallback-sadtalker');
    expect(exhausted.rerollReasons).toContain('face-artifact');

    const forbidden=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs,2,false));
    expect(forbidden.action).toBe('manual-review');
  });

  it('never cascades a failed SadTalker fallback into another silent provider',()=>{
    const obs=observations('sadtalker','talking-head',{
      'lip-sync':{score:.4,evidenceIds:['sync-qc:bad']},
    });
    const decision=evaluateDirectorHumanMediaQc(input('sadtalker','talking-head',obs,1,true));
    expect(decision.action).toBe('manual-review');
    expect(decision.rerollReasons).toContain('lip-sync-drift');
  });

  it('requires independent speaker identity evidence for a Coqui clone',()=>{
    const missing=observations('coqui-tts','voice-clone')
      .filter(item=>item.metric!=='speaker-similarity');
    const reobserve=evaluateDirectorHumanMediaQc(input('coqui-tts','voice-clone',missing));
    expect(reobserve.action).toBe('reobserve');
    expect(reobserve.reasons).toContain('DIRECTOR_HUMAN_MEDIA_QC_MISSING:speaker-similarity');

    const drift=observations('coqui-tts','voice-clone',{
      'speaker-similarity':{
        score:.61,
        evidenceIds:['speaker-qc:ecapa:1'],
        source:'speaker-qc',
      },
    });
    const reroll=evaluateDirectorHumanMediaQc(input('coqui-tts','voice-clone',drift));
    expect(reroll.action).toBe('reroll-same-engine');
    expect(reroll.rerollReasons).toContain('speaker-drift');
  });

  it('maps Watch visual/temporal evidence without fabricating lip-sync or dialogue scores',()=>{
    const mapped=humanMediaWatchEvidenceToQc([
      {
        dimension:'technical',
        score:.9,
        confidence:.8,
        evidenceIds:['sampled-frame:1'],
      },
      {
        dimension:'continuity',
        score:.77,
        confidence:.7,
        evidenceIds:['sampled-frame:1','sampled-frame:4'],
        hardFailures:['identity-flicker'],
      },
      {
        dimension:'story-function',
        score:.95,
        confidence:.9,
        evidenceIds:['sampled-frame:1'],
      },
    ]);
    expect(mapped.map(item=>item.metric)).toEqual(['technical-integrity','temporal-consistency']);
    expect(mapped.find(item=>item.metric==='temporal-consistency')?.source).toBe('watch-temporal');
    expect(mapped.some(item=>item.metric==='lip-sync')).toBe(false);
    expect(mapped.find(item=>item.metric==='temporal-consistency')?.hardFailure).toBe(true);
  });

  it('reuses DirectedTakeQC evidence for identity, face, motion, performance and sync',()=>{
    const mapped=directedTakeObservationsToHumanMediaQc([
      {
        metric:'identity-stability',
        score:.9,
        confidence:.8,
        evidenceIds:['identity:1'],
      },
      {
        metric:'audio-sync',
        score:.88,
        confidence:.9,
        evidenceIds:['sync:1'],
        startSeconds:1,
        endSeconds:2,
      },
      {
        metric:'camera-plan-match',
        score:.9,
        confidence:.9,
        evidenceIds:['camera:1'],
      },
    ]);
    expect(mapped.map(item=>item.metric)).toEqual(['identity-stability','lip-sync']);
    expect(mapped[1]).toMatchObject({startSeconds:1,endSeconds:2,source:'directed-take-qc'});
  });

  it('converts QC evidence into the existing multimodal take-selection contract',()=>{
    const obs=observations('musetalk','lip-sync');
    const decision=evaluateDirectorHumanMediaQc(input('musetalk','lip-sync',obs));
    const candidate=humanMediaQcToTakeCandidate({
      takeId:'take:1',
      assetId:'asset:output',
      observations:obs,
      decision,
    });
    expect(candidate.takeId).toBe('take:1');
    expect(candidate.hardFailures).toEqual([]);
    expect(candidate.dimensions.map(item=>item.dimension)).toEqual(expect.arrayContaining([
      'technical','visual-readability','continuity','motion','lip-sync',
    ]));
  });

  it('fails closed on execution/output lineage mismatch instead of spending on a reroll',()=>{
    const bad={...receipt('musetalk','lip-sync'),jobId:'job:other'};
    const decision=evaluateDirectorHumanMediaQc({
      ...input('musetalk','lip-sync',observations('musetalk','lip-sync')),
      executionReceipt:bad,
    });
    expect(decision.action).toBe('manual-review');
    expect(decision.reasons).toContain('DIRECTOR_HUMAN_MEDIA_QC_EXECUTION_JOB_MISMATCH');
  });
});
