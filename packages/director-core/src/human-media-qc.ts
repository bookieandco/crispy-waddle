import type {
  DirectorHumanMediaEngine,
  DirectorHumanMediaExecutionReceipt,
  DirectorHumanMediaTaskKind,
} from './human-media-worker-contract.js';
import type {
  DirectedTakeQcObservation,
} from './directed-take-qc.js';
import type {
  MultimodalTakeCandidate,
  TakeDimensionEvidence,
  TakeScoreDimension,
} from './multimodal-take-selection.js';

export type DirectorHumanMediaQcMetric =
  | 'technical-integrity'
  | 'visual-readability'
  | 'identity-stability'
  | 'face-stability'
  | 'temporal-consistency'
  | 'motion-naturalism'
  | 'performance-match'
  | 'lip-sync'
  | 'speaker-similarity'
  | 'speech-intelligibility'
  | 'prosody-match'
  | 'pronunciation'
  | 'source-preservation';

export type DirectorHumanMediaQcSource =
  | 'watch'
  | 'watch-temporal'
  | 'identity-qc'
  | 'speaker-qc'
  | 'sync-qc'
  | 'audio-qc'
  | 'directed-take-qc'
  | 'human-review';

export interface DirectorHumanMediaQcObservation {
  metric: DirectorHumanMediaQcMetric;
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
  source: DirectorHumanMediaQcSource;
  hardFailure?: boolean;
  startSeconds?: number;
  endSeconds?: number;
  notes?: readonly string[];
}

export interface DirectorHumanMediaWatchEvidence {
  dimension:
    | 'technical'
    | 'visual-readability'
    | 'performance'
    | 'story-function'
    | 'source-relevance'
    | 'continuity'
    | 'motion';
  score: number;
  confidence: number;
  evidenceIds: readonly string[];
  hardFailures?: readonly string[];
  observationIds?: readonly string[];
  notes?: readonly string[];
}

export type DirectorHumanMediaQcAction =
  | 'accept'
  | 'reobserve'
  | 'localized-repair'
  | 'reroll-same-engine'
  | 'fallback-sadtalker'
  | 'manual-review';

export type DirectorHumanMediaRerollReason =
  | 'technical-artifact'
  | 'visual-artifact'
  | 'identity-drift'
  | 'face-artifact'
  | 'temporal-flicker'
  | 'motion-unnatural'
  | 'performance-mismatch'
  | 'lip-sync-drift'
  | 'speaker-drift'
  | 'unintelligible-speech'
  | 'prosody-mismatch'
  | 'pronunciation-error'
  | 'source-drift'
  | 'quality-evidence-missing'
  | 'quality-evidence-low-confidence'
  | 'quality-evidence-invalid'
  | 'unknown-quality-failure';

export interface DirectorHumanMediaQcPolicy {
  id: string;
  engine: DirectorHumanMediaEngine;
  task: DirectorHumanMediaTaskKind;
  requiredMetrics: readonly DirectorHumanMediaQcMetric[];
  minimumScoreByMetric: Readonly<Partial<Record<DirectorHumanMediaQcMetric, number>>>;
  minimumConfidence: number;
  repairableMetrics: readonly DirectorHumanMediaQcMetric[];
  maxSameEngineAttempts: number;
}

export interface DirectorHumanMediaQcInput {
  projectId: string;
  jobId: string;
  outputAssetId: string;
  outputSha256: string;
  executionReceipt: DirectorHumanMediaExecutionReceipt;
  observations: readonly DirectorHumanMediaQcObservation[];
  attempt: number;
  fallbackAllowed?: boolean;
  evidenceIds: readonly string[];
}

export interface DirectorHumanMediaQcDecision {
  admissible: boolean;
  action: DirectorHumanMediaQcAction;
  policyId: string;
  reasons: readonly string[];
  rerollReasons: readonly DirectorHumanMediaRerollReason[];
  failingMetrics: readonly DirectorHumanMediaQcMetric[];
  evidenceIds: readonly string[];
  repairRange?: Readonly<{startSeconds:number;endSeconds:number}>;
  preserve: readonly string[];
  authority: 'DIRECTOR_HUMAN_MEDIA_QC';
}

const SHA256_RE=/^(?:sha256:)?[a-f0-9]{64}$/i;

function normalizeSha256(value:string):string{
  return value.trim().toLowerCase().replace(/^sha256:/,'');
}

const BASE_VISUAL_THRESHOLDS:Readonly<Partial<Record<DirectorHumanMediaQcMetric,number>>>=Object.freeze({
  'technical-integrity':.72,
  'visual-readability':.72,
  'identity-stability':.82,
  'face-stability':.76,
  'temporal-consistency':.75,
  'motion-naturalism':.70,
  'performance-match':.70,
  'source-preservation':.80,
});

function policy(
  input:Omit<DirectorHumanMediaQcPolicy,'minimumConfidence'|'maxSameEngineAttempts'> &
    Partial<Pick<DirectorHumanMediaQcPolicy,'minimumConfidence'|'maxSameEngineAttempts'>>,
):DirectorHumanMediaQcPolicy{
  return Object.freeze({
    ...input,
    requiredMetrics:Object.freeze([...input.requiredMetrics]),
    minimumScoreByMetric:Object.freeze({...input.minimumScoreByMetric}),
    repairableMetrics:Object.freeze([...input.repairableMetrics]),
    minimumConfidence:input.minimumConfidence??.55,
    maxSameEngineAttempts:input.maxSameEngineAttempts??2,
  });
}

export const DIRECTOR_HUMAN_MEDIA_QC_POLICIES:readonly DirectorHumanMediaQcPolicy[]=Object.freeze([
  policy({
    id:'human-media:musetalk-lipsync:v1',
    engine:'musetalk',
    task:'lip-sync',
    requiredMetrics:[
      'technical-integrity','visual-readability','identity-stability','face-stability',
      'temporal-consistency','motion-naturalism','lip-sync',
    ],
    minimumScoreByMetric:{...BASE_VISUAL_THRESHOLDS,'lip-sync':.84},
    repairableMetrics:['face-stability','temporal-consistency','lip-sync'],
    maxSameEngineAttempts:2,
  }),
  policy({
    id:'human-media:liveportrait-performance:v1',
    engine:'liveportrait',
    task:'portrait-animation',
    requiredMetrics:[
      'technical-integrity','visual-readability','identity-stability','face-stability',
      'temporal-consistency','motion-naturalism','performance-match','source-preservation',
    ],
    minimumScoreByMetric:{
      ...BASE_VISUAL_THRESHOLDS,
      'identity-stability':.84,
      'temporal-consistency':.78,
      'motion-naturalism':.76,
      'performance-match':.74,
      'source-preservation':.84,
    },
    repairableMetrics:['face-stability','temporal-consistency','motion-naturalism','performance-match'],
    maxSameEngineAttempts:2,
  }),
  policy({
    id:'human-media:sadtalker-fallback:v1',
    engine:'sadtalker',
    task:'talking-head',
    requiredMetrics:[
      'technical-integrity','visual-readability','identity-stability','face-stability',
      'temporal-consistency','motion-naturalism','lip-sync',
    ],
    minimumScoreByMetric:{
      ...BASE_VISUAL_THRESHOLDS,
      'face-stability':.74,
      'temporal-consistency':.74,
      'motion-naturalism':.68,
      'lip-sync':.80,
    },
    repairableMetrics:['face-stability','temporal-consistency','lip-sync'],
    maxSameEngineAttempts:1,
  }),
  policy({
    id:'human-media:coqui-synthesis:v1',
    engine:'coqui-tts',
    task:'voice-synthesis',
    requiredMetrics:['technical-integrity','speech-intelligibility','prosody-match','pronunciation'],
    minimumScoreByMetric:{
      'technical-integrity':.90,
      'speech-intelligibility':.92,
      'prosody-match':.72,
      pronunciation:.82,
    },
    repairableMetrics:['prosody-match','pronunciation'],
    minimumConfidence:.60,
    maxSameEngineAttempts:2,
  }),
  policy({
    id:'human-media:coqui-clone:v1',
    engine:'coqui-tts',
    task:'voice-clone',
    requiredMetrics:[
      'technical-integrity','speaker-similarity','speech-intelligibility','prosody-match','pronunciation',
    ],
    minimumScoreByMetric:{
      'technical-integrity':.90,
      'speaker-similarity':.85,
      'speech-intelligibility':.92,
      'prosody-match':.72,
      pronunciation:.82,
    },
    repairableMetrics:['prosody-match','pronunciation'],
    minimumConfidence:.60,
    maxSameEngineAttempts:2,
  }),
  policy({
    id:'human-media:coqui-conversion:v1',
    engine:'coqui-tts',
    task:'voice-conversion',
    requiredMetrics:[
      'technical-integrity','speaker-similarity','speech-intelligibility','prosody-match','pronunciation',
    ],
    minimumScoreByMetric:{
      'technical-integrity':.90,
      'speaker-similarity':.85,
      'speech-intelligibility':.90,
      'prosody-match':.70,
      pronunciation:.80,
    },
    repairableMetrics:['prosody-match','pronunciation'],
    minimumConfidence:.60,
    maxSameEngineAttempts:2,
  }),
]);

function unique(values:readonly string[]):string[]{
  return [...new Set(values.map(value=>value.trim()).filter(Boolean))];
}

function policyFor(engine:DirectorHumanMediaEngine,task:DirectorHumanMediaTaskKind):DirectorHumanMediaQcPolicy{
  const found=DIRECTOR_HUMAN_MEDIA_QC_POLICIES.find(candidate=>candidate.engine===engine&&candidate.task===task);
  if(!found)throw new Error(`DIRECTOR_HUMAN_MEDIA_QC_POLICY_NOT_FOUND:${engine}:${task}`);
  return found;
}

function validObservation(observation:DirectorHumanMediaQcObservation):boolean{
  return Number.isFinite(observation.score)&&observation.score>=0&&observation.score<=1&&
    Number.isFinite(observation.confidence)&&observation.confidence>=0&&observation.confidence<=1;
}

function aggregateObservations(
  observations:readonly DirectorHumanMediaQcObservation[],
):Map<DirectorHumanMediaQcMetric,DirectorHumanMediaQcObservation>{
  const grouped=new Map<DirectorHumanMediaQcMetric,DirectorHumanMediaQcObservation[]>();
  for(const observation of observations){
    const list=grouped.get(observation.metric)??[];
    list.push(observation);
    grouped.set(observation.metric,list);
  }
  const result=new Map<DirectorHumanMediaQcMetric,DirectorHumanMediaQcObservation>();
  for(const [metric,list] of grouped){
    const valid=list.filter(validObservation);
    if(!valid.length){
      result.set(metric,Object.freeze({
        metric,
        score:Number.NaN,
        confidence:Number.NaN,
        evidenceIds:Object.freeze(unique(list.flatMap(item=>item.evidenceIds))),
        source:list[0]?.source??'human-review',
        hardFailure:list.some(item=>item.hardFailure===true),
        notes:Object.freeze(unique(list.flatMap(item=>item.notes??[]))),
      }));
      continue;
    }
    const weakest=[...valid].sort((a,b)=>a.score-b.score||a.confidence-b.confidence)[0]!;
    const ranged=valid.filter(item=>
      item.startSeconds!==undefined&&item.endSeconds!==undefined&&
      Number.isFinite(item.startSeconds)&&Number.isFinite(item.endSeconds)&&
      item.endSeconds!>item.startSeconds!
    );
    result.set(metric,Object.freeze({
      metric,
      score:Math.min(...valid.map(item=>item.score)),
      confidence:Math.min(...valid.map(item=>item.confidence)),
      evidenceIds:Object.freeze(unique(valid.flatMap(item=>item.evidenceIds))),
      source:weakest.source,
      hardFailure:valid.some(item=>item.hardFailure===true),
      ...(ranged.length===valid.length&&ranged.length
        ?{
          startSeconds:Math.min(...ranged.map(item=>item.startSeconds!)),
          endSeconds:Math.max(...ranged.map(item=>item.endSeconds!)),
        }
        :{}),
      notes:Object.freeze(unique(valid.flatMap(item=>item.notes??[]))),
    }));
  }
  return result;
}

function rerollReason(metric:DirectorHumanMediaQcMetric):DirectorHumanMediaRerollReason{
  const map:Record<DirectorHumanMediaQcMetric,DirectorHumanMediaRerollReason>={
    'technical-integrity':'technical-artifact',
    'visual-readability':'visual-artifact',
    'identity-stability':'identity-drift',
    'face-stability':'face-artifact',
    'temporal-consistency':'temporal-flicker',
    'motion-naturalism':'motion-unnatural',
    'performance-match':'performance-mismatch',
    'lip-sync':'lip-sync-drift',
    'speaker-similarity':'speaker-drift',
    'speech-intelligibility':'unintelligible-speech',
    'prosody-match':'prosody-mismatch',
    pronunciation:'pronunciation-error',
    'source-preservation':'source-drift',
  };
  return map[metric];
}

function repairRange(
  failing:readonly DirectorHumanMediaQcObservation[],
):Readonly<{startSeconds:number;endSeconds:number}>|undefined{
  if(!failing.length)return undefined;
  if(!failing.every(item=>
    item.startSeconds!==undefined&&item.endSeconds!==undefined&&
    Number.isFinite(item.startSeconds)&&Number.isFinite(item.endSeconds)&&
    item.endSeconds!>item.startSeconds!
  ))return undefined;
  return Object.freeze({
    startSeconds:Math.min(...failing.map(item=>item.startSeconds!)),
    endSeconds:Math.max(...failing.map(item=>item.endSeconds!)),
  });
}

function preserveFor(failing:readonly DirectorHumanMediaQcMetric[]):readonly string[]{
  const preserve=new Set(['approved-script','product-truth','creator-rights','runtime-provenance']);
  if(!failing.includes('identity-stability'))preserve.add('actor-identity');
  if(!failing.includes('source-preservation'))preserve.add('source-media');
  if(!failing.includes('performance-match'))preserve.add('performance-plan');
  if(!failing.includes('speaker-similarity'))preserve.add('voice-identity');
  if(!failing.includes('lip-sync'))preserve.add('approved-audio');
  return Object.freeze([...preserve]);
}

function evidenceFailureReason(reason:string):boolean{
  return reason.includes('_MISSING:')||reason.includes('_EVIDENCE_REQUIRED:')||reason.includes('_CONFIDENCE_LOW:')||reason.includes('_SCORE_INVALID:');
}

export function evaluateDirectorHumanMediaQc(
  input:DirectorHumanMediaQcInput,
):DirectorHumanMediaQcDecision{
  const policy=policyFor(input.executionReceipt.engine,input.executionReceipt.task);
  const reasons:string[]=[];
  if(!input.projectId.trim()||!input.jobId.trim()||!input.outputAssetId.trim()||!input.evidenceIds.length){
    reasons.push('DIRECTOR_HUMAN_MEDIA_QC_IDENTITY_OR_EVIDENCE_REQUIRED');
  }
  if(input.executionReceipt.jobId!==input.jobId){
    reasons.push('DIRECTOR_HUMAN_MEDIA_QC_EXECUTION_JOB_MISMATCH');
  }
  if(input.executionReceipt.status!=='ready'||!input.executionReceipt.output){
    reasons.push('DIRECTOR_HUMAN_MEDIA_QC_READY_OUTPUT_REQUIRED');
  }else{
    if(normalizeSha256(input.executionReceipt.output.sha256)!==normalizeSha256(input.outputSha256)){
      reasons.push('DIRECTOR_HUMAN_MEDIA_QC_OUTPUT_HASH_MISMATCH');
    }
  }
  if(!SHA256_RE.test(input.outputSha256.trim())){
    reasons.push('DIRECTOR_HUMAN_MEDIA_QC_OUTPUT_HASH_INVALID');
  }
  if(!Number.isInteger(input.attempt)||input.attempt<1){
    reasons.push('DIRECTOR_HUMAN_MEDIA_QC_ATTEMPT_INVALID');
  }

  const byMetric=aggregateObservations(input.observations);
  const failingMetrics:DirectorHumanMediaQcMetric[]=[];
  for(const metric of policy.requiredMetrics){
    const observation=byMetric.get(metric);
    if(!observation){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_MISSING:${metric}`);
      continue;
    }
    if(!validObservation(observation)){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_SCORE_INVALID:${metric}`);
      continue;
    }
    if(!observation.evidenceIds.length){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_EVIDENCE_REQUIRED:${metric}`);
    }
    if(observation.confidence<policy.minimumConfidence){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_CONFIDENCE_LOW:${metric}`);
    }
    const minimum=policy.minimumScoreByMetric[metric]??0;
    if(observation.score<minimum){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_SCORE_LOW:${metric}`);
      failingMetrics.push(metric);
    }
    if(observation.hardFailure){
      reasons.push(`DIRECTOR_HUMAN_MEDIA_QC_HARD_FAILURE:${metric}`);
      failingMetrics.push(metric);
    }
  }

  const uniqueFailing=unique(failingMetrics) as DirectorHumanMediaQcMetric[];
  const structural=reasons.some(reason=>
    reason==='DIRECTOR_HUMAN_MEDIA_QC_IDENTITY_OR_EVIDENCE_REQUIRED'||
    reason==='DIRECTOR_HUMAN_MEDIA_QC_EXECUTION_JOB_MISMATCH'||
    reason==='DIRECTOR_HUMAN_MEDIA_QC_READY_OUTPUT_REQUIRED'||
    reason==='DIRECTOR_HUMAN_MEDIA_QC_OUTPUT_HASH_MISMATCH'||
    reason==='DIRECTOR_HUMAN_MEDIA_QC_OUTPUT_HASH_INVALID'||
    reason==='DIRECTOR_HUMAN_MEDIA_QC_ATTEMPT_INVALID'
  );
  const evidenceOnly=reasons.length>0&&!structural&&reasons.every(evidenceFailureReason);
  const admissible=reasons.length===0;

  const failingObservations=uniqueFailing
    .map(metric=>byMetric.get(metric))
    .filter((value):value is DirectorHumanMediaQcObservation=>Boolean(value));
  const range=repairRange(failingObservations);
  const repairable=uniqueFailing.length>0&&
    uniqueFailing.every(metric=>policy.repairableMetrics.includes(metric))&&
    Boolean(range);

  let action:DirectorHumanMediaQcAction;
  if(admissible)action='accept';
  else if(structural)action='manual-review';
  else if(evidenceOnly)action='reobserve';
  else if(repairable)action='localized-repair';
  else if(input.attempt<policy.maxSameEngineAttempts)action='reroll-same-engine';
  else if(
    input.executionReceipt.engine==='musetalk'&&
    input.executionReceipt.task==='lip-sync'&&
    input.fallbackAllowed===true
  )action='fallback-sadtalker';
  else action='manual-review';

  const rerollReasons:DirectorHumanMediaRerollReason[]=[];
  if(reasons.some(reason=>reason.includes('_MISSING:')||reason.includes('_EVIDENCE_REQUIRED:'))){
    rerollReasons.push('quality-evidence-missing');
  }
  if(reasons.some(reason=>reason.includes('_CONFIDENCE_LOW:'))){
    rerollReasons.push('quality-evidence-low-confidence');
  }
  if(reasons.some(reason=>reason.includes('_SCORE_INVALID:'))){
    rerollReasons.push('quality-evidence-invalid');
  }
  for(const metric of uniqueFailing)rerollReasons.push(rerollReason(metric));
  if(!admissible&&!rerollReasons.length)rerollReasons.push('unknown-quality-failure');

  const evidenceIds=unique([
    ...input.evidenceIds,
    ...input.observations.flatMap(observation=>observation.evidenceIds),
    `human-media-execution:${input.executionReceipt.providerJobId}`,
    `human-media-output:${input.outputAssetId}:${normalizeSha256(input.outputSha256)}`,
    `human-media-qc-policy:${policy.id}`,
  ]);

  return Object.freeze({
    admissible,
    action,
    policyId:policy.id,
    reasons:Object.freeze(unique(reasons)),
    rerollReasons:Object.freeze(unique(rerollReasons) as DirectorHumanMediaRerollReason[]),
    failingMetrics:Object.freeze(uniqueFailing),
    evidenceIds:Object.freeze(evidenceIds),
    ...(range&&action==='localized-repair'?{repairRange:range}:{}),
    preserve:preserveFor(uniqueFailing),
    authority:'DIRECTOR_HUMAN_MEDIA_QC',
  });
}

export function humanMediaWatchEvidenceToQc(
  evidence:readonly DirectorHumanMediaWatchEvidence[],
):readonly DirectorHumanMediaQcObservation[]{
  const map:Partial<Record<DirectorHumanMediaWatchEvidence['dimension'],DirectorHumanMediaQcMetric>>={
    technical:'technical-integrity',
    'visual-readability':'visual-readability',
    performance:'performance-match',
    'source-relevance':'source-preservation',
    continuity:'temporal-consistency',
    motion:'motion-naturalism',
  };
  return Object.freeze(evidence.flatMap(item=>{
    const metric=map[item.dimension];
    if(!metric)return [];
    return [Object.freeze({
      metric,
      score:item.score,
      confidence:item.confidence,
      evidenceIds:Object.freeze(unique(item.evidenceIds)),
      source:item.dimension==='continuity'||item.dimension==='motion'?'watch-temporal':'watch',
      hardFailure:Boolean(item.hardFailures?.length),
      notes:Object.freeze(unique([
        ...(item.notes??[]),
        ...(item.hardFailures??[]).map(value=>`watch-hard-failure:${value}`),
      ])),
    }) satisfies DirectorHumanMediaQcObservation];
  }));
}

export function directedTakeObservationsToHumanMediaQc(
  observations:readonly DirectedTakeQcObservation[],
):readonly DirectorHumanMediaQcObservation[]{
  const map:Partial<Record<DirectedTakeQcObservation['metric'],DirectorHumanMediaQcMetric>>={
    'identity-stability':'identity-stability',
    'face-stability':'face-stability',
    'temporal-flicker':'temporal-consistency',
    'motion-plausibility':'motion-naturalism',
    'performance-plan-match':'performance-match',
    'audio-sync':'lip-sync',
    'dialogue-prosody':'prosody-match',
    'source-preservation':'source-preservation',
  };
  return Object.freeze(observations.flatMap(item=>{
    const metric=map[item.metric];
    if(!metric)return [];
    return [Object.freeze({
      metric,
      score:item.score,
      confidence:item.confidence,
      evidenceIds:Object.freeze(unique(item.evidenceIds)),
      source:'directed-take-qc',
      hardFailure:item.hardFailure,
      ...(item.startSeconds!==undefined?{startSeconds:item.startSeconds}:{}),
      ...(item.endSeconds!==undefined?{endSeconds:item.endSeconds}:{}),
      notes:Object.freeze(unique(item.notes??[])),
    }) satisfies DirectorHumanMediaQcObservation];
  }));
}

function takeDimensionFor(metric:DirectorHumanMediaQcMetric):TakeScoreDimension|undefined{
  const map:Partial<Record<DirectorHumanMediaQcMetric,TakeScoreDimension>>={
    'technical-integrity':'technical',
    'visual-readability':'visual-readability',
    'temporal-consistency':'continuity',
    'motion-naturalism':'motion',
    'performance-match':'performance',
    'lip-sync':'lip-sync',
    'speech-intelligibility':'dialogue',
    'source-preservation':'source-relevance',
  };
  return map[metric];
}

export function humanMediaQcToTakeCandidate(input:{
  takeId:string;
  assetId:string;
  observations:readonly DirectorHumanMediaQcObservation[];
  decision:DirectorHumanMediaQcDecision;
}):MultimodalTakeCandidate{
  const byDimension=new Map<TakeScoreDimension,TakeDimensionEvidence[]>();
  for(const observation of input.observations){
    const dimension=takeDimensionFor(observation.metric);
    if(!dimension)continue;
    const list=byDimension.get(dimension)??[];
    list.push({
      dimension,
      score:observation.score,
      confidence:observation.confidence,
      evidenceIds:observation.evidenceIds,
      notes:observation.notes,
    });
    byDimension.set(dimension,list);
  }
  const dimensions=[...byDimension.entries()].map(([dimension,list])=>{
    const weakest=[...list].sort((a,b)=>a.score-b.score||a.confidence-b.confidence)[0]!;
    return Object.freeze({
      dimension,
      score:Math.min(...list.map(item=>item.score)),
      confidence:Math.min(...list.map(item=>item.confidence)),
      evidenceIds:Object.freeze(unique(list.flatMap(item=>item.evidenceIds))),
      notes:Object.freeze(unique(list.flatMap(item=>item.notes??[]))),
    }) satisfies TakeDimensionEvidence;
  });

  return Object.freeze({
    takeId:input.takeId,
    assetId:input.assetId,
    dimensions:Object.freeze(dimensions),
    hardFailures:Object.freeze(input.decision.admissible?[]:[...input.decision.reasons]),
    observationIds:Object.freeze(unique(input.decision.evidenceIds)),
  });
}
