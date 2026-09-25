import type { DialogueGenerationRequest } from './voice-identity.js';
import type { TimelineClip } from './timeline-model.js';

export type SoundtrackTempo =
  | { mode: 'slow' | 'medium' | 'fast' }
  | { mode: 'bpm'; bpm: number };

export interface SoundtrackGenerationBrief {
  id: string;
  projectId: string;
  purpose: string;
  moodTags: readonly string[];
  styleTags: readonly string[];
  energy: number;
  tempo: SoundtrackTempo;
  durationSeconds: number;
  variationCount: number;
  sourceVideoAssetId?: string;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_SOUNDTRACK_BRIEF';
}

export interface GeneratedSoundtrackCandidate {
  id: string;
  requestId: string;
  candidateIndex: number;
  assetId: string;
  sha256: string;
  provider: string;
  modelId: string;
  durationSeconds: number;
  moodAlignmentScore: number;
  purposeAlignmentScore: number;
  beatAlignmentScore?: number;
  rightsEvidenceIds: readonly string[];
  evidenceIds: readonly string[];
}

export interface SoundtrackCandidatePolicy {
  durationToleranceSeconds: number;
  minimumMoodAlignment: number;
  minimumPurposeAlignment: number;
  minimumBeatAlignment?: number;
}

export interface SpeechToneSpan {
  id: string;
  startChar: number;
  endChar: number;
  tone: string;
  scope: 'sentence' | 'phrase';
  evidenceIds: readonly string[];
}

export interface SpeechPauseInstruction {
  id: string;
  afterChar: number;
  durationMs: number;
}

export interface SpeechPerformancePlan {
  id: string;
  projectId: string;
  characterId: string;
  voiceIdentityId: string;
  voiceVariantId: string;
  language: string;
  text: string;
  sceneId: string;
  lineId: string;
  speed: number;
  pitchSemitones: number;
  toneSpans: readonly SpeechToneSpan[];
  pauses: readonly SpeechPauseInstruction[];
  targetDurationSeconds?: number;
  evidenceIds: readonly string[];
  authority: 'DIRECTOR_SPEECH_PERFORMANCE';
}

export function validateSoundtrackGenerationBrief(
  brief: SoundtrackGenerationBrief,
): readonly string[] {
  const reasons:string[]=[];
  if(!brief.id.trim()||!brief.projectId.trim()||!brief.purpose.trim()) {
    reasons.push('DIRECTOR_SOUNDTRACK_IDENTITY_REQUIRED');
  }
  if(!brief.moodTags.length) reasons.push('DIRECTOR_SOUNDTRACK_MOOD_REQUIRED');
  if(!brief.styleTags.length) reasons.push('DIRECTOR_SOUNDTRACK_STYLE_REQUIRED');
  if(!Number.isFinite(brief.energy)||brief.energy<0||brief.energy>1) {
    reasons.push('DIRECTOR_SOUNDTRACK_ENERGY_INVALID');
  }
  if(
    brief.tempo.mode==='bpm' &&
    (!Number.isFinite(brief.tempo.bpm)||brief.tempo.bpm<20||brief.tempo.bpm>300)
  ) reasons.push('DIRECTOR_SOUNDTRACK_TEMPO_INVALID');
  if(!Number.isFinite(brief.durationSeconds)||brief.durationSeconds<=0) {
    reasons.push('DIRECTOR_SOUNDTRACK_DURATION_INVALID');
  }
  if(!Number.isInteger(brief.variationCount)||brief.variationCount<1||brief.variationCount>8) {
    reasons.push('DIRECTOR_SOUNDTRACK_VARIATION_COUNT_INVALID');
  }
  if(!brief.evidenceIds.length) reasons.push('DIRECTOR_SOUNDTRACK_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function selectBestSoundtrackCandidate(
  brief:SoundtrackGenerationBrief,
  candidates:readonly GeneratedSoundtrackCandidate[],
  policy:SoundtrackCandidatePolicy,
):GeneratedSoundtrackCandidate|undefined{
  const briefErrors=validateSoundtrackGenerationBrief(brief);
  if(briefErrors.length) throw new Error(`DIRECTOR_SOUNDTRACK_BRIEF_INVALID: ${briefErrors.join(', ')}`);

  return [...candidates]
    .filter(candidate=>validateSoundtrackCandidate(brief,candidate,policy).length===0)
    .sort((a,b)=>
      soundtrackScore(b,policy)-soundtrackScore(a,policy) ||
      a.candidateIndex-b.candidateIndex ||
      a.id.localeCompare(b.id)
    )[0];
}

export function validateSoundtrackCandidate(
  brief:SoundtrackGenerationBrief,
  candidate:GeneratedSoundtrackCandidate,
  policy:SoundtrackCandidatePolicy,
):readonly string[]{
  const reasons:string[]=[];
  if(candidate.requestId!==brief.id) reasons.push('DIRECTOR_SOUNDTRACK_REQUEST_MISMATCH');
  if(!candidate.id.trim()||!candidate.assetId.trim()||!candidate.sha256.trim()) {
    reasons.push('DIRECTOR_SOUNDTRACK_ARTIFACT_REQUIRED');
  }
  if(!Number.isInteger(candidate.candidateIndex)||candidate.candidateIndex<1) {
    reasons.push('DIRECTOR_SOUNDTRACK_CANDIDATE_INDEX_INVALID');
  }
  if(
    !Number.isFinite(candidate.durationSeconds)||
    Math.abs(candidate.durationSeconds-brief.durationSeconds)>policy.durationToleranceSeconds
  ) reasons.push('DIRECTOR_SOUNDTRACK_DURATION_MISMATCH');
  if(!scoreAtLeast(candidate.moodAlignmentScore,policy.minimumMoodAlignment)) {
    reasons.push('DIRECTOR_SOUNDTRACK_MOOD_ALIGNMENT_LOW');
  }
  if(!scoreAtLeast(candidate.purposeAlignmentScore,policy.minimumPurposeAlignment)) {
    reasons.push('DIRECTOR_SOUNDTRACK_PURPOSE_ALIGNMENT_LOW');
  }
  if(
    policy.minimumBeatAlignment!==undefined &&
    !scoreAtLeast(candidate.beatAlignmentScore,policy.minimumBeatAlignment)
  ) reasons.push('DIRECTOR_SOUNDTRACK_BEAT_ALIGNMENT_LOW');
  if(!candidate.rightsEvidenceIds.length) reasons.push('DIRECTOR_SOUNDTRACK_RIGHTS_EVIDENCE_REQUIRED');
  if(!candidate.evidenceIds.length) reasons.push('DIRECTOR_SOUNDTRACK_OUTPUT_EVIDENCE_REQUIRED');
  return Object.freeze([...new Set(reasons)]);
}

export function soundtrackCandidateToTimelineClip(input:{
  brief:SoundtrackGenerationBrief;
  candidate:GeneratedSoundtrackCandidate;
  trackId:string;
  startSeconds:number;
}):TimelineClip{
  if(validateSoundtrackCandidate(input.brief,input.candidate,{
    durationToleranceSeconds:Number.POSITIVE_INFINITY,
    minimumMoodAlignment:0,
    minimumPurposeAlignment:0,
  }).some(reason=>
    reason==='DIRECTOR_SOUNDTRACK_REQUEST_MISMATCH' ||
    reason==='DIRECTOR_SOUNDTRACK_ARTIFACT_REQUIRED' ||
    reason==='DIRECTOR_SOUNDTRACK_RIGHTS_EVIDENCE_REQUIRED'
  )) throw new Error('DIRECTOR_SOUNDTRACK_TIMELINE_INSERTION_INVALID');
  if(!input.trackId.trim()||!Number.isFinite(input.startSeconds)||input.startSeconds<0) {
    throw new Error('DIRECTOR_SOUNDTRACK_TIMELINE_TARGET_INVALID');
  }
  return Object.freeze({
    id:`soundtrack:${input.candidate.id}`,
    name:`Generated soundtrack — ${input.brief.purpose}`,
    assetId:input.candidate.assetId,
    trackId:input.trackId,
    startSeconds:input.startSeconds,
    durationSeconds:input.candidate.durationSeconds,
    sourceInSeconds:0,
    sourceOutSeconds:input.candidate.durationSeconds,
    sourceDurationSeconds:input.candidate.durationSeconds,
    audioRole:'music',
    effects:[],
    generativeRegions:[],
  });
}

export function validateSpeechPerformancePlan(
  plan:SpeechPerformancePlan,
):readonly string[]{
  const reasons:string[]=[];
  if(
    !plan.id.trim()||!plan.projectId.trim()||!plan.characterId.trim()||
    !plan.voiceIdentityId.trim()||!plan.voiceVariantId.trim()||
    !plan.language.trim()||!plan.sceneId.trim()||!plan.lineId.trim()
  ) reasons.push('DIRECTOR_SPEECH_PERFORMANCE_IDENTITY_REQUIRED');
  if(!plan.text.trim()) reasons.push('DIRECTOR_SPEECH_PERFORMANCE_TEXT_REQUIRED');
  if(!Number.isFinite(plan.speed)||plan.speed<0.5||plan.speed>2) {
    reasons.push('DIRECTOR_SPEECH_PERFORMANCE_SPEED_INVALID');
  }
  if(!Number.isFinite(plan.pitchSemitones)||plan.pitchSemitones<-12||plan.pitchSemitones>12) {
    reasons.push('DIRECTOR_SPEECH_PERFORMANCE_PITCH_INVALID');
  }
  if(
    plan.targetDurationSeconds!==undefined &&
    (!Number.isFinite(plan.targetDurationSeconds)||plan.targetDurationSeconds<=0)
  ) reasons.push('DIRECTOR_SPEECH_PERFORMANCE_DURATION_INVALID');
  if(!plan.evidenceIds.length) reasons.push('DIRECTOR_SPEECH_PERFORMANCE_EVIDENCE_REQUIRED');

  const ordered=[...plan.toneSpans].sort((a,b)=>a.startChar-b.startChar||a.endChar-b.endChar||a.id.localeCompare(b.id));
  let previousEnd=-1;
  for(const span of ordered){
    if(
      !span.id.trim()||!span.tone.trim()||!span.evidenceIds.length||
      !Number.isInteger(span.startChar)||!Number.isInteger(span.endChar)||
      span.startChar<0||span.endChar<=span.startChar||span.endChar>plan.text.length
    ) reasons.push(`DIRECTOR_SPEECH_TONE_SPAN_INVALID:${span.id||'unknown'}`);
    if(span.startChar<previousEnd) reasons.push('DIRECTOR_SPEECH_TONE_SPAN_OVERLAP');
    previousEnd=Math.max(previousEnd,span.endChar);
  }

  const pausePositions=new Set<number>();
  for(const pause of plan.pauses){
    if(
      !pause.id.trim()||!Number.isInteger(pause.afterChar)||pause.afterChar<0||pause.afterChar>plan.text.length||
      !Number.isInteger(pause.durationMs)||pause.durationMs<50||pause.durationMs>10_000
    ) reasons.push(`DIRECTOR_SPEECH_PAUSE_INVALID:${pause.id||'unknown'}`);
    if(pausePositions.has(pause.afterChar)) reasons.push(`DIRECTOR_SPEECH_PAUSE_DUPLICATE:${pause.afterChar}`);
    pausePositions.add(pause.afterChar);
  }
  return Object.freeze([...new Set(reasons)]);
}

export function speechPerformanceToDialogueRequest(
  plan:SpeechPerformancePlan,
):DialogueGenerationRequest{
  const reasons=validateSpeechPerformancePlan(plan);
  if(reasons.length) throw new Error(`DIRECTOR_SPEECH_PERFORMANCE_INVALID: ${reasons.join(', ')}`);
  const toneDirective=plan.toneSpans
    .map(span=>`${span.scope} "${plan.text.slice(span.startChar,span.endChar)}" => tone ${span.tone}`)
    .join('; ');
  const pauseDirective=plan.pauses
    .map(pause=>`pause ${pause.durationMs}ms after char ${pause.afterChar}`)
    .join('; ');
  const deliveryInstruction=[
    `speed ${plan.speed.toFixed(2)}x`,
    `pitch ${plan.pitchSemitones>=0?'+':''}${plan.pitchSemitones.toFixed(1)} semitones`,
    toneDirective||undefined,
    pauseDirective||undefined,
  ].filter((value):value is string=>Boolean(value)).join('; ');

  return Object.freeze({
    id:plan.id,
    projectId:plan.projectId,
    characterId:plan.characterId,
    voiceIdentityId:plan.voiceIdentityId,
    voiceVariantId:plan.voiceVariantId,
    language:plan.language,
    text:plan.text,
    sceneId:plan.sceneId,
    lineId:plan.lineId,
    deliveryInstruction,
    targetDurationSeconds:plan.targetDurationSeconds,
    evidenceIds:Object.freeze([...plan.evidenceIds,...plan.toneSpans.flatMap(span=>span.evidenceIds)]),
  });
}

function soundtrackScore(candidate:GeneratedSoundtrackCandidate,policy:SoundtrackCandidatePolicy):number{
  const beat=policy.minimumBeatAlignment===undefined ? 0 : (candidate.beatAlignmentScore ?? 0);
  return candidate.moodAlignmentScore*.45+candidate.purposeAlignmentScore*.4+beat*.15;
}

function scoreAtLeast(value:number|undefined,minimum:number):boolean{
  return value!==undefined&&Number.isFinite(value)&&value>=minimum&&value<=1;
}
